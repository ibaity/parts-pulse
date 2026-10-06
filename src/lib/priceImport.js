import { normalizeCode } from '@/lib/analysisUtils';
import { round2 } from '@/lib/partConstants';
import { manufacturerUsage } from '@/lib/dedupe';

export const PRICE_FIELDS = [
  { key: 'code', label: 'Mediserv code', required: true, hints: ['mediserv code', 'mediserv', 'item code', 'item no', 'code', 'كود'] },
  { key: 'price', label: 'Price', required: true, hints: ['blended pricelist', 'pricelist', 'price list', 'unit price', 'price', 'السعر', 'سعر'] },
  { key: 'maker_pn', label: 'Manufacturer part no.', required: false, hints: ['pn manufactur', 'manufacturer part', 'manufacturer pn', 'mfr part', 'mfr pn', 'part number', 'pn'] },
  { key: 'description', label: 'Description', required: false, hints: ['material description', 'description', 'desc', 'الوصف'] },
];

// Picks the most likely column for each field from the header names.
export function detectPriceColumns(columns) {
  const mapping = {};
  const used = new Set();
  for (const field of PRICE_FIELDS) {
    for (const hint of field.hints) {
      const match = columns.find(c => !used.has(c) && c.toString().toLowerCase().trim().includes(hint));
      if (match) { mapping[field.key] = match; used.add(match); break; }
    }
  }
  return mapping;
}

const toPrice = (v) => {
  const n = Number(String(v ?? '').replace(/[, ]/g, ''));
  return Number.isFinite(n) && n > 0 ? round2(n) : null;
};

// Compares a price file with the master items. Nothing is written here.
export function buildPriceUpdatePlan(rows, mapping, masterItems) {
  const byCode = new Map();
  for (const m of masterItems) {
    const k = normalizeCode(m.mediserv_item_code);
    if (!k) continue;
    if (!byCode.has(k)) byCode.set(k, []);
    byCode.get(k).push(m);
  }
  const usage = manufacturerUsage(masterItems);
  // A manufacturer code used by several parts is a brand name (e.g. "Werfen"), not a part number.
  const isBrandLike = (code) => { const k = normalizeCode(code); return k && usage.get(k) > 2; };

  // Last row wins if a code is repeated in the file.
  const fileRows = new Map();
  let duplicatesInFile = 0;
  let invalid = 0;
  for (const r of rows) {
    const code = String(r[mapping.code] ?? '').trim();
    const key = normalizeCode(code);
    const price = toPrice(r[mapping.price]);
    if (!key || price === null) { invalid++; continue; }
    if (fileRows.has(key)) duplicatesInFile++;
    fileRows.set(key, {
      code,
      price,
      makerPn: mapping.maker_pn ? String(r[mapping.maker_pn] ?? '').trim() : '',
      description: mapping.description ? String(r[mapping.description] ?? '').trim() : '',
    });
  }

  const changes = [];     // price differs
  const makerFixes = [];  // manufacturer part number can be filled / corrected
  const notFound = [];    // in file, not in master
  let unchanged = 0;
  for (const [key, row] of fileRows) {
    const items = byCode.get(key);
    if (!items) { notFound.push(row); continue; }
    let priceChanged = false;
    for (const item of items) {
      const old = round2(item.unit_price);
      const patch = {};
      if (old !== row.price) { patch.unit_price = row.price; priceChanged = true; changes.push({ item, oldPrice: old, newPrice: row.price, pct: old > 0 ? ((row.price - old) / old) * 100 : null }); }
      const current = item.manufacturer_item_code;
      if (row.makerPn && normalizeCode(current) !== normalizeCode(row.makerPn) && (!normalizeCode(current) || isBrandLike(current))) {
        makerFixes.push({ item, from: current || '', to: row.makerPn });
      }
    }
    if (!priceChanged) unchanged++;
  }
  const missingInFile = [...byCode.keys()].filter(k => !fileRows.has(k)).length;
  return { changes, makerFixes, notFound, unchanged, duplicatesInFile, invalid, missingInFile, fileCount: fileRows.size, matched: fileRows.size - notFound.length };
}
