import * as XLSX from 'xlsx';

export const REPORT_FIELDS = [
  { key: 'item_code', label: 'Item Code', required: true, hints: ['item code', 'item no', 'item number', 'itemcode', 'sku', 'part no', 'part number', 'code', 'item', 'كود', 'رقم الصنف', 'الصنف'] },
  { key: 'quantity', label: 'Quantity', required: true, hints: ['on hand', 'onhand', 'quantity', 'qty', 'balance', 'stock', 'available', 'الكمية', 'كمية', 'الرصيد', 'رصيد'] },
  { key: 'warehouse', label: 'Warehouse', required: false, hints: ['warehouse', 'whse', 'wh', 'store', 'location', 'site', 'المستودع', 'مستودع', 'الموقع', 'المخزن'] },
  { key: 'warehouse_name', label: 'Warehouse / Engineer Name', required: false, hints: ['warehouse name', 'whse name', 'location name', 'store name', 'engineer', 'technician', 'employee', 'اسم المستودع', 'اسم المهندس', 'المهندس', 'الفني'] },
];

// Name columns are detected first so "Warehouse Name" isn't taken as the warehouse code column.
const DETECT_ORDER = ['item_code', 'quantity', 'warehouse_name', 'warehouse'];

const SPREADSHEET_EXT = /\.(xlsx|xls|csv)$/i;

export function isSpreadsheet(fileName) {
  return SPREADSHEET_EXT.test(fileName || '');
}

// Picks the most likely column for each field from the header names.
export function detectColumns(columns) {
  const mapping = {};
  const used = new Set();
  for (const field of DETECT_ORDER.map(k => REPORT_FIELDS.find(f => f.key === k))) {
    for (const hint of field.hints) {
      const match = columns.find(c => !used.has(c) && c.toString().toLowerCase().trim().includes(hint));
      if (match) {
        mapping[field.key] = match;
        used.add(match);
        break;
      }
    }
  }
  return mapping;
}

export function readSheet(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return { rows, columns };
}

export function rowsToReportItems(rows, mapping) {
  return rows
    .map(r => ({
      item_code: String(r[mapping.item_code] ?? '').trim(),
      warehouse: mapping.warehouse ? String(r[mapping.warehouse] ?? '').trim() : '',
      warehouse_name: mapping.warehouse_name ? String(r[mapping.warehouse_name] ?? '').trim() : '',
      quantity: Number(String(r[mapping.quantity] ?? '').replace(/,/g, '')) || 0,
    }))
    .filter(r => r.item_code);
}

// Used when re-running an analysis from a stored spreadsheet URL.
export async function parseSpreadsheetUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download the report file');
  const { rows, columns } = readSheet(await res.arrayBuffer());
  const mapping = detectColumns(columns);
  if (!mapping.item_code || !mapping.quantity) {
    throw new Error('Could not detect Item Code / Quantity columns in the report');
  }
  return rowsToReportItems(rows, mapping);
}
