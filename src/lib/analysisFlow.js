import { base44 } from '@/api/base44Client';
import { runAnalysis, normalizeName } from '@/lib/analysisUtils';
import { fetchAll } from '@/lib/fetchAll';
import { isSpreadsheet, parseSpreadsheetUrl } from '@/lib/reportParser';

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

async function extractFromPdf(fileUrl) {
  const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url: fileUrl,
    json_schema: EXTRACT_SCHEMA,
  });
  if (extractResult.status === 'error') {
    throw new Error(extractResult.details || 'PDF extraction failed');
  }
  return Array.isArray(extractResult.output)
    ? extractResult.output
    : extractResult.output?.items || [];
}

// reportItems: rows already parsed in the browser (Excel/CSV). When omitted, the stored file is read.
export async function executeAnalysisFlow({ vendorId, pdfFileUrl, pdfFileName, reportItems, onStep }) {
  const spreadsheet = isSpreadsheet(pdfFileName);
  onStep?.(spreadsheet ? 'Reading report...' : 'Extracting data from PDF (this may take a moment)...');
  // Create the run record and read the report in parallel — they don't depend on each other.
  const [run, pdfItems] = await Promise.all([
    base44.entities.AnalysisRun.create({
      vendor_id: vendorId,
      pdf_file_url: pdfFileUrl,
      pdf_file_name: pdfFileName,
      status: 'processing',
    }),
    reportItems
      ? Promise.resolve(reportItems)
      : spreadsheet ? parseSpreadsheetUrl(pdfFileUrl) : extractFromPdf(pdfFileUrl),
  ]);

  try {
    return await analyzeAndSave({ run, vendorId, pdfItems, onStep });
  } catch (err) {
    await base44.entities.AnalysisRun.update(run.id, { status: 'failed' }).catch(() => {});
    throw err;
  }
}

async function analyzeAndSave({ run, vendorId, pdfItems, onStep }) {
  if (pdfItems.length === 0) {
    throw new Error('No items found in the report. Make sure it contains item codes and quantities.');
  }

  onStep?.('Loading master items and warehouses...');
  const [masterItems, warehouses] = await Promise.all([
    fetchAll(base44.entities.MasterItem, { vendor_id: vendorId }),
    base44.entities.Warehouse.list('-created_date', 200),
  ]);

  // Warehouses seen in the report but not defined yet are registered as enabled,
  // so count them as enabled in this run too (otherwise the first run undercounts stock).
  const known = new Set();
  warehouses.forEach(w => {
    if (w.name) known.add(normalizeName(w.name));
    if (w.code) known.add(normalizeName(w.code));
  });
  const newWhNames = [...new Set(
    pdfItems.map(r => (r.warehouse ?? '').toString().trim()).filter(Boolean)
  )].filter(n => !known.has(normalizeName(n)));
  const newWarehouses = newWhNames.map(name => ({ name, enabled: true, important: false, visible: true }));
  const enabledWarehouses = [...warehouses.filter(w => w.enabled), ...newWarehouses];

  onStep?.('Running analysis...');
  const { results, summary } = runAnalysis(pdfItems, masterItems, enabledWarehouses);

  onStep?.('Saving results...');
  const itemsToSave = results.map(r => ({
    ...r,
    analysis_run_id: run.id,
    vendor_id: vendorId,
  }));
  const chunks = [];
  for (let i = 0; i < itemsToSave.length; i += CHUNK_SIZE) chunks.push(itemsToSave.slice(i, i + CHUNK_SIZE));
  await Promise.all([
    ...chunks.map(chunk => base44.entities.AnalysisItem.bulkCreate(chunk)),
    newWarehouses.length > 0 ? base44.entities.Warehouse.bulkCreate(newWarehouses) : null,
  ]);

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
