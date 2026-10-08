export function normalizeName(name) {
  return (name || '').toString().toLowerCase().trim();
}

// Item codes often differ only by separators ("AB-123" vs "AB 123" vs "ab123").
export function normalizeCode(code) {
  return normalizeName(code).replace(/[\s\-_./\\]+/g, '');
}

// Catalog matching key: Immucor parts may be coded "D IMMU 0064730", "D-IMMU-64730" or just "64730",
// so the "D IMMU" prefix and leading zeros are ignored and all of these link to catalog part 0064730.
export function catalogCodeKey(code) {
  return normalizeCode(code).replace(/^dimmu(?:cor)?(?=\d)/, '').replace(/^0+(?=.)/, '');
}

// Engineer stock locations are warehouse codes starting with "E" + digits, e.g. "E101" or "E101 - Ahmed Ali".
const ENGINEER_CODE = /^(e\d+)\b[\s\-–:|/]*(.*)$/i;

export function isEngineerWarehouse(name) {
  return ENGINEER_CODE.test((name || '').toString().trim());
}

// Splits a warehouse value into a stable key and a display name ("E101 - Ahmed" -> E101 / Ahmed).
export function parseWarehouse(value) {
  const raw = (value || '').toString().trim();
  const m = raw.match(ENGINEER_CODE);
  if (m) return { key: m[1].toUpperCase(), name: m[2].trim() };
  return { key: raw.toUpperCase(), name: '' };
}

// Exact match on warehouse name or code — partial matching made "WH1" also match "WH10".
export function isWarehouseEnabled(warehouseName, enabledWarehouses) {
  const normalized = normalizeName(warehouseName);
  if (!normalized) return false;
  return enabledWarehouses.some(wh =>
    normalizeName(wh.name) === normalized || (wh.code && normalizeName(wh.code) === normalized)
  );
}

export function buildMasterIndex(masterItems) {
  const byMediserv = new Map();
  const byManufacturer = new Map();
  for (const mi of masterItems) {
    const m = normalizeCode(mi.mediserv_item_code);
    const f = normalizeCode(mi.manufacturer_item_code);
    if (m && !byMediserv.has(m)) byMediserv.set(m, mi);
    if (f && !byManufacturer.has(f)) byManufacturer.set(f, mi);
  }
  return { byMediserv, byManufacturer };
}

export function matchMasterItem(itemCode, index) {
  const code = normalizeCode(itemCode);
  if (!code) return { item: null, matchedVia: 'none' };
  const viaMediserv = index.byMediserv.get(code);
  if (viaMediserv) return { item: viaMediserv, matchedVia: 'mediserv_code' };
  const viaManufacturer = index.byManufacturer.get(code);
  if (viaManufacturer) return { item: viaManufacturer, matchedVia: 'manufacturer_code' };
  return { item: null, matchedVia: 'none' };
}

function stockResult(itemCode, masterItem, matchedVia, currentStock, warehouseBreakdown) {
  const minStock = Number(masterItem.minimum_stock) || 0;
  const needsPurchase = currentStock < minStock;
  return {
    item_code: itemCode,
    description: masterItem.description || '',
    current_stock: currentStock,
    minimum_stock: minStock,
    recommended_quantity: needsPurchase ? minStock - currentStock : 0,
    unit_price: Number(masterItem.unit_price) || 0,
    status: !needsPurchase ? 'sufficient' : currentStock <= 0 ? 'critical' : 'low',
    matched_via: matchedVia,
    warehouse_breakdown: warehouseBreakdown,
  };
}

// An item is "missing from report" when it has a minimum stock but did not appear in the report at all.
export function isMissingFromReport(result) {
  return result.status === 'critical'
    && (!result.warehouse_breakdown || Object.keys(result.warehouse_breakdown).length === 0);
}

export function runAnalysis(reportItems, masterItems, enabledWarehouses) {
  const itemMap = new Map();
  const warehouseLabels = new Map();

  for (const row of reportItems) {
    const code = (row.item_code ?? '').toString().trim();
    if (!code) continue;
    const key = normalizeCode(code);
    if (!itemMap.has(key)) itemMap.set(key, { code, warehouses: new Map() });

    const whName = (row.warehouse ?? '').toString().trim() || 'Unknown';
    const qty = Number(row.quantity) || 0;
    const warehouses = itemMap.get(key).warehouses;
    warehouses.set(whName, (warehouses.get(whName) || 0) + qty);
    const label = (row.warehouse_name ?? '').toString().trim();
    if (label && label.toUpperCase() !== whName.toUpperCase()) warehouseLabels.set(whName, label);
  }

  const index = buildMasterIndex(masterItems);
  const matchedMasterIds = new Set();
  const results = [];

  for (const { code, warehouses } of itemMap.values()) {
    let currentStock = 0;
    const warehouseBreakdown = {};
    for (const [whName, qty] of warehouses) {
      const enabled = isWarehouseEnabled(whName, enabledWarehouses);
      warehouseBreakdown[whName] = { quantity: qty, enabled };
      const label = warehouseLabels.get(whName) || parseWarehouse(whName).name;
      if (label) warehouseBreakdown[whName].name = label;
      if (enabled) currentStock += qty;
    }

    const { item: masterItem, matchedVia } = matchMasterItem(code, index);
    if (!masterItem) {
      results.push({
        item_code: code,
        description: '',
        current_stock: currentStock,
        minimum_stock: 0,
        recommended_quantity: 0,
        status: 'unknown',
        matched_via: 'none',
        warehouse_breakdown: warehouseBreakdown,
      });
      continue;
    }
    matchedMasterIds.add(masterItem.id);
    results.push(stockResult(code, masterItem, matchedVia, currentStock, warehouseBreakdown));
  }

  // Master items with a minimum stock that are absent from the report have zero stock.
  for (const mi of masterItems) {
    if (matchedMasterIds.has(mi.id)) continue;
    if ((Number(mi.minimum_stock) || 0) <= 0) continue;
    const code = mi.mediserv_item_code || mi.manufacturer_item_code;
    if (!code) continue;
    results.push(stockResult(code, mi, mi.mediserv_item_code ? 'mediserv_code' : 'manufacturer_code', 0, {}));
  }

  const summary = {
    total_items: results.length,
    items_to_purchase: results.filter(r => r.status === 'critical' || r.status === 'low').length,
    critical_items: results.filter(r => r.status === 'critical').length,
    unknown_items: results.filter(r => r.status === 'unknown').length,
  };

  return { results, summary };
}
