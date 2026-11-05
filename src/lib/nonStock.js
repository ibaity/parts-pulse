import { catalogCodeKey } from '@/lib/analysisUtils';

// Non-stock goods are held outside the system, one location code per city.
export const NON_STOCK_LOCATIONS = [
  { code: 'N102', city: 'Riyadh', names: ['riyadh', 'الرياض', 'رياض'] },
  { code: 'N202', city: 'Jeddah', names: ['jeddah', 'jedda', 'jiddah', 'جدة', 'جده'] },
  { code: 'N302', city: 'Khobar', names: ['khobar', 'alkhobar', 'الخبر', 'خبر', 'dammam', 'الدمام', 'دمام'] },
];

export const NON_STOCK_CODES = NON_STOCK_LOCATIONS.map(l => l.code);

export const cityOf = (code) => NON_STOCK_LOCATIONS.find(l => l.code === code)?.city || '';

export const locationLabel = (code) => (code ? `${code} · ${cityOf(code)}` : 'No location');

// Reads a location from a cell: "N202", "n202 - Jeddah", "Jeddah" or "جدة" all give "N202". Unknown gives ''.
export function parseLocationCode(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '';
  const byCode = text.match(/\bn\s*-?\s*(\d{3})\b/);
  if (byCode) {
    const code = `N${byCode[1]}`;
    if (NON_STOCK_CODES.includes(code)) return code;
  }
  return NON_STOCK_LOCATIONS.find(l => l.names.some(n => text.includes(n)))?.code || '';
}

// Items saved before location codes existed only carry a city.
export function locationOf(item) {
  if (NON_STOCK_CODES.includes(item?.location_code)) return item.location_code;
  return parseLocationCode(item?.city);
}

export const NON_STOCK_FIELDS = [
  { key: 'item_code', label: 'Item Code', required: true, hints: ['item code', 'item no', 'item number', 'itemcode', 'part no', 'part number', 'ref', 'sku', 'code', 'item', 'كود', 'رقم الصنف', 'الصنف'] },
  { key: 'description', label: 'Description', required: false, hints: ['description', 'desc', 'item name', 'الوصف', 'وصف', 'اسم الصنف', 'name'] },
  { key: 'quantity', label: 'Quantity', required: true, hints: ['on hand', 'onhand', 'quantity', 'qty', 'balance', 'stock', 'الكمية', 'كمية', 'الرصيد', 'رصيد'] },
  { key: 'unit', label: 'Unit', required: false, hints: ['unit', 'uom', 'الوحدة', 'وحدة'] },
  { key: 'location', label: 'Location (N102 / N202 / N302)', required: false, hints: ['location', 'warehouse', 'whse', 'store', 'city', 'site', 'الموقع', 'المستودع', 'مستودع', 'المدينة', 'المخزن'] },
];

// Columns are matched in this order so "Item Description" isn't taken as the item code column.
const DETECT_ORDER = ['description', 'item_code', 'quantity', 'unit', 'location'];

// A sheet can hold one quantity column per location, e.g. "N202 Jeddah" | "N102 Riyadh" | "N302 Khobar".
// Only headers that carry the code itself count, so a "City" column is never read as a quantity.
export function detectLocationColumns(columns) {
  const byCode = {};
  for (const c of columns) {
    const text = String(c);
    if (!/\bn\s*-?\s*\d{3}\b/i.test(text)) continue;
    const code = parseLocationCode(text);
    if (code && !byCode[code]) byCode[code] = c;
  }
  return byCode;
}

// Returns { item_code, description, quantity, unit, location, locationColumns }.
// With location columns found, the quantity and location columns are not needed.
export function detectNonStockColumns(columns) {
  const locationColumns = detectLocationColumns(columns);
  const wide = Object.keys(locationColumns).length > 0;
  const mapping = wide ? { locationColumns } : {};
  const used = new Set(Object.values(locationColumns));
  for (const key of DETECT_ORDER) {
    if (wide && (key === 'quantity' || key === 'location')) continue;
    const field = NON_STOCK_FIELDS.find(f => f.key === key);
    for (const hint of field.hints) {
      const match = columns.find(c => !used.has(c) && String(c).toLowerCase().trim().includes(hint));
      if (match) {
        mapping[key] = match;
        used.add(match);
        break;
      }
    }
  }
  return mapping;
}

const toNumber = (value) => Number(String(value ?? '').replace(/,/g, '').trim()) || 0;

export const hasLocationColumns = (mapping) => Object.keys(mapping?.locationColumns || {}).length > 0;

// One record per part and location: repeated rows add up. Each row's own location wins over the fallback.
// Returns { items, noLocation, emptyQty } where the counts are rows (or parts) left out.
export function rowsToNonStockItems(rows, mapping, fallbackCode = '') {
  const byKey = new Map();
  let noLocation = 0;
  const wide = hasLocationColumns(mapping);
  const add = (r, itemCode, code, qty) => {
    const key = `${code}|${catalogCodeKey(itemCode) || itemCode.toLowerCase()}`;
    if (!byKey.has(key)) {
      byKey.set(key, { item_code: itemCode, description: '', quantity: 0, unit: '', location_code: code, city: cityOf(code) });
    }
    const rec = byKey.get(key);
    rec.quantity += qty;
    if (!rec.description && mapping.description) rec.description = String(r[mapping.description] ?? '').trim();
    if (!rec.unit && mapping.unit) rec.unit = String(r[mapping.unit] ?? '').trim();
  };
  for (const r of rows) {
    const itemCode = String(r[mapping.item_code] ?? '').trim();
    if (!itemCode) continue;
    if (wide) {
      for (const [code, col] of Object.entries(mapping.locationColumns)) {
        const qty = toNumber(r[col]);
        if (qty) add(r, itemCode, code, qty);
      }
      continue;
    }
    const code = (mapping.location && parseLocationCode(r[mapping.location])) || fallbackCode;
    if (!code) { noLocation++; continue; }
    add(r, itemCode, code, mapping.quantity ? toNumber(r[mapping.quantity]) : 0);
  }
  const all = [...byKey.values()];
  const items = all.filter(i => i.quantity > 0);
  return { items, noLocation, emptyQty: all.length - items.length };
}

// Uploading replaces the vendor's available stock in each location the file has; used items stay as history.
// In the wide layout every location column counts, so a column that is now empty clears that location.
export function planReplace(existing, incoming, { vendorId = '', locations: fileLocations } = {}) {
  const locations = new Set(fileLocations || incoming.map(i => i.location_code));
  const toDelete = existing
    .filter(i => i.status !== 'used' && (i.vendor_id || '') === vendorId && locations.has(locationOf(i)))
    .map(i => i.id);
  const toCreate = incoming.map(i => ({ ...i, status: 'available', ...(vendorId ? { vendor_id: vendorId } : {}) }));
  return { locations: [...locations], toDelete, toCreate };
}

// Locations an upload replaces: every location column in the wide layout, else the locations its rows name.
export function uploadLocations(mapping, items) {
  if (hasLocationColumns(mapping)) return Object.keys(mapping.locationColumns);
  return [...new Set(items.map(i => i.location_code))];
}

// The vendor whose name appears in the file name, e.g. "Non-Stock_Werfen.xlsx" → Werfen.
export function vendorFromFileName(fileName, vendors) {
  const name = String(fileName || '').toLowerCase();
  return vendors.find(v => v.name && name.includes(v.name.toLowerCase().trim()))?.id || '';
}

// Item count and total quantity of available stock per location code, plus 'All'.
export function stockTotals(items) {
  const totals = { All: { items: 0, quantity: 0 } };
  for (const code of NON_STOCK_CODES) totals[code] = { items: 0, quantity: 0 };
  for (const i of items) {
    if (i.status === 'used') continue;
    const code = locationOf(i);
    for (const k of ['All', code]) {
      if (!totals[k]) continue;
      totals[k].items += 1;
      totals[k].quantity += Number(i.quantity) || 0;
    }
  }
  return totals;
}

// Available non-stock items indexed by part identity key, so catalog part numbers find them.
export function indexNonStock(items) {
  const byKey = new Map();
  for (const i of items) {
    if (i.status === 'used' || !(Number(i.quantity) > 0)) continue;
    const key = catalogCodeKey(i.item_code);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(i);
  }
  return byKey;
}

// Non-stock on hand for any of the given codes: { total, locations: [{ code, city, quantity }] }, or null if none.
export function lookupNonStock(index, codes) {
  if (!index) return null;
  const found = new Set();
  for (const c of codes) {
    const key = catalogCodeKey(c);
    if (key) (index.get(key) || []).forEach(i => found.add(i));
  }
  if (!found.size) return null;
  const byLocation = new Map();
  for (const i of found) {
    const code = locationOf(i);
    byLocation.set(code, (byLocation.get(code) || 0) + (Number(i.quantity) || 0));
  }
  const locations = [...byLocation.entries()]
    .map(([code, quantity]) => ({ code, city: cityOf(code), quantity }))
    .sort((a, b) => b.quantity - a.quantity);
  return { total: locations.reduce((s, l) => s + l.quantity, 0), locations };
}
