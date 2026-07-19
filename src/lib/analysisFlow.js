import { base44 } from '@/api/base44Client';
import { runAnalysis } from '@/lib/analysisUtils';

const CHUNK_SIZE = 500;

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_code: { type: 'string', description: 'The item/product code or SKU number' },
          warehouse: { type: 'string', description: 'The warehouse name or identifier where the item is stored' },
          quantity: { type: 'number', description: 'The quantity on hand for this item in this warehouse' },
        },
      },
    },
  },
};

export async function executeAnalysisFlow({ vendorId, pdfFileUrl, pdfFileName, onStep }) {
  onStep?.('Creating analysis run...');
  const run = await base44.entities.AnalysisRun.create({
    vendor_id: vendorId,
    pdf_file_url: pdfFileUrl,
    pdf_file_name: pdfFileName,
    status: 'processing',
  });

  onStep?.('Extracting data from PDF (this may take a moment)...');
  const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url: pdfFileUrl,
    json_schema: EXTRACT_SCHEMA,
  });

  if (extractResult.status === 'error') {
    throw new Error(extractResult.details || 'PDF extraction failed');
  }

  const pdfItems = Array.isArray(extractResult.output)
    ? extractResult.output
    : extractResult.output?.items || [];

  if (pdfItems.length === 0) {
    throw new Error('No items found in PDF. Make sure the PDF contains item codes and quantities.');
  }

  onStep?.('Loading master items...');
  const masterItems = await base44.entities.MasterItem.filter({ vendor_id: vendorId });

  onStep?.('Loading warehouses...');
  const warehouses = await base44.entities.Warehouse.list('-created_date', 200);
  const enabledWarehouses = warehouses.filter(w => w.enabled);

  onStep?.('Running analysis...');
  const { results, summary } = runAnalysis(pdfItems, masterItems, enabledWarehouses);

  onStep?.('Saving results...');
  const itemsToSave = results.map(r => ({
    ...r,
    analysis_run_id: run.id,
    vendor_id: vendorId,
  }));
  for (let i = 0; i < itemsToSave.length; i += CHUNK_SIZE) {
    await base44.entities.AnalysisItem.bulkCreate(itemsToSave.slice(i, i + CHUNK_SIZE));
  }

  onStep?.('Finalizing...');
  await base44.entities.AnalysisRun.update(run.id, {
    status: 'completed',
    total_items: summary.total_items,
    items_to_purchase: summary.items_to_purchase,
    critical_items: summary.critical_items,
    unknown_items: summary.unknown_items,
  });

  return { run, results, summary, enabledWarehouseCount: enabledWarehouses.length };
}