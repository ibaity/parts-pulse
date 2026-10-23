import { base44 } from '@/api/base44Client';
import { runAnalysis, normalizeName, isEngineerWarehouse } from '@/lib/analysisUtils';
import { fetchAll } from '@/lib/fetchAll';
import { isSpreadsheet, parseSpreadsheetUrl } from '@/lib/reportParser';
import { parsePdfReport, parseTxtReport } from '@/lib/pdfReport';

const TEXT_EXT = /\.(txt)$/i;
const isTextFile = (name) => TEXT_EXT.test(name || '');

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
          warehouse: { type: 'string', description: 'The warehouse code or identifier where the item is stored' },
          warehouse_name: { type: 'string', description: 'The warehouse description or the engineer/technician name for that warehouse, if shown' },
          quantity: { type: 'number', description: 'The quantity on hand for this item in this warehouse' },
        },
      },
    },
  },
};

// The company report layout is read directly (every row); any other PDF goes to AI extraction.
// Returns { items, meta } (meta is null when the report header is unknown).
async function extractFromPdf(fileUrl) {
  try {
    const res = await fetch(fileUrl);
    if (res.ok) {
      const report = await parsePdfReport(await res.arrayBuffer());
      if (report) return report;
    }
  } catch (err) {
    console.warn('Direct read failed, using AI extraction', err);
  }

  const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url: fileUrl,
    json_schema: EXTRACT_SCHEMA,
  });
  if (extractResult.status === 'error') {
    throw new Error(extractResult.details || 'Report extraction failed');
  }
  const items = Array.isArray(extractResult.output)
    ? extractResult.output
    : extractResult.output?.items || [];
  return { items, meta: null };
}

// TXT reports must have the company report layout; AI guessing at plain text could invent quantities.
async function extractFromTxtUrl(fileUrl) {
  if (!fileUrl) throw new Error('The TXT file of this run was not saved. Upload the report again to analyze it.');
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error('Could not download the report file');
  const report = parseTxtReport(await res.text());
  if (!report) throw new Error('This TXT file is not in the MEDISERV stock report layout.');
  return report;
}

async function readStoredReport(fileUrl, fileName) {
  if (isTextFile(fileName)) return extractFromTxtUrl(fileUrl);
  if (isSpreadsheet(fileName)) return { items: await parseSpreadsheetUrl(fileUrl), meta: null };
  return extractFromPdf(fileUrl);
}

// reportItems: rows already parsed in the browser (Excel/CSV/TXT/PDF), with reportMeta from the report header.
// When omitted (Re-run), the stored file is read again.
export async function executeAnalysisFlow({ vendorId, pdfFileUrl, pdfFileName, reportItems, reportMeta, onStep }) {
  onStep?.('Reading report...');
  // Create the run record and read the report in parallel — they don't depend on each other.
  // A report that can't be read still marks its run as failed.
  const [runResult, reportResult] = await Promise.allSettled([
    base44.entities.AnalysisRun.create({
      vendor_id: vendorId,
      pdf_file_url: pdfFileUrl,
      pdf_file_name: pdfFileName,
      status: 'processing',
    }),
    reportItems
      ? Promise.resolve({ items: reportItems, meta: reportMeta || null })
      : readStoredReport(pdfFileUrl, pdfFileName),
  ]);
  if (runResult.status === 'rejected') throw runResult.reason;
  const run = runResult.value;

  try {
    if (reportResult.status === 'rejected') throw reportResult.reason;
    const { items, meta } = reportResult.value;
    return await analyzeAndSave({ run, vendorId, pdfItems: items, meta, onStep });
  } catch (err) {
    await base44.entities.AnalysisRun.update(run.id, { status: 'failed' }).catch(() => {});
    throw err;
  }
}

async function analyzeAndSave({ run, vendorId, pdfItems, meta, onStep }) {
  if (pdfItems.length === 0) {
    throw new Error('No items found in the report. Make sure it contains item codes and quantities.');
  }

  onStep?.('Loading master items and warehouses...');
  const [masterItems, warehouses] = await Promise.all([
    fetchAll(base44.entities.MasterItem, { vendor_id: vendorId }),
    base44.entities.Warehouse.list('-created_date', 200),
  ]);

  const { newWarehouses, warehouseUpdates } = planWarehouses(pdfItems, warehouses);
  for (const { id, ...changes } of warehouseUpdates) Object.assign(warehouses.find(w => w.id === id), changes);
  const enabledWarehouses = [...warehouses, ...newWarehouses].filter(w => w.enabled);

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
    ...warehouseUpdates.map(({ id, ...changes }) => base44.entities.Warehouse.update(id, changes)),
  ]);

  onStep?.('Finalizing...');
  await base44.entities.AnalysisRun.update(run.id, {
    status: 'completed',
    total_items: summary.total_items,
    items_to_purchase: summary.items_to_purchase,
    critical_items: summary.critical_items,
    unknown_items: summary.unknown_items,
    ...(meta?.report_date ? { report_date: meta.report_date } : {}),
  });

  return {
    run,
    results,
    summary,
    enabledWarehouseCount: enabledWarehouses.length,
    newEngineerWarehouses: newWarehouses.filter(w => !w.enabled).length,
  };
}

// Warehouses seen in the report but not defined yet are registered with their code and name
// ("A102" / "Riyadh Service"). Engineer stock (E…) is added as not counted; other new warehouses count.
// A warehouse defined earlier by its code or name alone gets the missing code / name filled in.
function planWarehouses(reportItems, warehouses) {
  const seen = new Map(); // report warehouse code -> name
  for (const r of reportItems) {
    const code = (r.warehouse ?? '').toString().trim();
    if (!code) continue;
    const name = (r.warehouse_name ?? '').toString().trim();
    if (!seen.get(code)) seen.set(code, name);
  }

  const newWarehouses = [];
  const warehouseUpdates = [];
  for (const [code, name] of seen) {
    const c = normalizeName(code);
    if (warehouses.some(w => w.code && normalizeName(w.code) === c)) continue;
    const byName = warehouses.find(w => !w.code
      && (normalizeName(w.name) === c || (name && normalizeName(w.name) === normalizeName(name))));
    if (byName) {
      if (name) warehouseUpdates.push({ id: byName.id, name, code });
      continue;
    }
    newWarehouses.push({ name: name || code, code, enabled: !isEngineerWarehouse(code), important: false, visible: true });
  }
  return { newWarehouses, warehouseUpdates };
}