export function normalizeName(name) {
  return (name || '').toString().toLowerCase().trim();
}

// Item codes often differ only by separators ("AB-123" vs "AB 123" vs "ab123").
export function normalizeCode(code) {
  return normalizeName(code).replace(/[\s\-_./\\]+/g, '');
}

// Prefixes put in front of the same part number: our system writes "D0064730", "DL0064730" or "D IMMU 0064730",
// the manufacturer writes "0064730" or "IMM0064730" (also "IMMU" / "IMMUCOR").
const CODE_PREFIX = /^(?:t|d(?:l|imm(?:u(?:cor)?)?)?|imm(?:u(?:cor)?)?)(?=\d)/;

// Normalized code without the "D" / "IMM" prefix, leading zeros kept ("IMM-0064730" -> "0064730").
export function stripCodePrefix(code) {
  return normalizeCode(code).replace(CODE_PREFIX, '');
}

// Part identity key: "D0064730", "DL0064730", "D IMMU 0064730", "IMM0064730", "D-IMMU-64730" and "64730" are all the same part,
// so the prefix and leading zeros are ignored and all of these link to catalog part 0064730.
export function catalogCodeKey(code) {
  return stripCodePrefix(code).replace(/^0+(?=.)/, '');
}

// Search helper: typing "D006", "IMM006" or "006" finds D0064730 and IMM0064730 alike.
export function codeIncludes(target, query) {
  const q = stripCodePrefix(query);
  return !!q && normalizeCode(target).includes(q);
}

// Part numbers written inside a name/description, e.g. "D IMMU 0065160 Wash Station Pump" -> 65160.
// Picks the code after a "D IMMU" / "IMM" prefix plus any standalone 7–8 digit number, optionally "D"/"DL"/"IMM"-prefixed.
export function catalogCodesInText(text) {
  const raw = (text || '').toString();
  const keys = new Set();
  const prefixed = raw.match(/^\s*(?:d[\s\-_.]*)?imm(?:u(?:cor)?)?[\s\-_.:#]*([a-z0-9][a-z0-9\-_.]*)/i);
  if (prefixed) keys.add(catalogCodeKey(prefixed[1]));
  for (const n of raw.match(/(?<![\w-])(?:dl?|imm(?:u(?:cor)?)?)?[\s\-]?\d{7,8}(?![\w-])/gi) || []) keys.add(catalogCodeKey(n));
  keys.delete('');
  return [...keys];
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

// Codes are indexed as written and by part key, so a report code "D0064730" still finds a master item
// recorded as "0064730" or "IMM0064730" (an exact match is preferred when both exist).
export function buildMasterIndex(masterItems) {
  const byMediserv = new Map();
  const byManufacturer = new Map();
  const byMediservKey = new Map();
  const byManufacturerKey = new Map();
  const add = (map, key, mi) => { if (key && !map.has(key)) map.set(key, mi); };
  for (const mi of masterItems) {
    add(byMediserv, normalizeCode(mi.mediserv_item_code), mi);
    add(byManufacturer, normalizeCode(mi.manufacturer_item_code), mi);
    add(byMediservKey, catalogCodeKey(mi.mediserv_item_code), mi);
    add(byManufacturerKey, catalogCodeKey(mi.manufacturer_item_code), mi);
  }
  return { byMediserv, byManufacturer, byMediservKey, byManufacturerKey };
}

export function matchMasterItem(itemCode, index) {
  const code = normalizeCode(itemCode);
  if (!code) return { item: null, matchedVia: 'none' };
  const key = catalogCodeKey(itemCode);
  const viaMediserv = index.byMediserv.get(code) || index.byMediservKey.get(key);
  if (viaMediserv) return { item: viaMediserv, matchedVia: 'mediserv_code' };
  const viaManufacturer = index.byManufacturer.get(code) || index.byManufacturerKey.get(key);
  if (viaManufacturer) return { item: viaManufacturer, matchedVia: 'manufacturer_code' };
  return { item: null, matchedVia: 'none' };
}

// The company report can list one stock line under two codes, e.g. "D0064682/0064697".
export function splitItemCode(code) {
  const raw = (code ?? '').toString().trim();
  const parts = raw.split('/').map(p => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [raw];
}

// Which code of a report line identifies the part: the code as written when the master list has it,
// else the first of its "/"-separated codes found there, else the first of them.
export function resolveReportCode(code, index) {
  const parts = splitItemCode(code);
  for (const candidate of parts.length > 1 ? [code, ...parts] : parts) {
    const match = matchMasterItem(candidate, index);
    if (match.item) return { code: candidate, ...match };
  }
  return { code: parts[0], item: null, matchedVia: 'none' };
}

// A warehouse counts toward stock when it is enabled; one not defined yet counts unless it is an
// engineer's stock (those are added as not counted until enabled on the Warehouses page).
export function countsTowardStock(warehouse, warehouses) {
  const normalized = normalizeName(warehouse);
  if (!normalized) return false;
  const known = warehouses.find(wh =>
    normalizeName(wh.name) === normalized || (wh.code && normalizeName(wh.code) === normalized)
  );
  return known ? !!known.enabled : !isEngineerWarehouse(warehouse);
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

  const index = buildMasterIndex(masterItems);

  for (const row of reportItems) {
    const written = (row.item_code ?? '').toString().trim();
    if (!written) continue;
    const { code, item, matchedVia } = resolveReportCode(written, index);
    // "D0064730" and "IMM0064730" rows in one report are the same part: their stock is added up.
    const key = catalogCodeKey(code);
    const fromSplit = code !== written;
    const group = itemMap.get(key);
    if (!group) itemMap.set(key, { code, item, matchedVia, fromSplit, warehouses: new Map() });
    // A part reached through "D0064682/0064697" is shown under its own plain code when the report has one.
    else if (group.fromSplit && !fromSplit) Object.assign(group, { code, item, matchedVia, fromSplit });

    const whName = (row.warehouse ?? '').toString().trim() || 'Unknown';
    const qty = Number(row.quantity) || 0;
    const warehouses = itemMap.get(key).warehouses;
    warehouses.set(whName, (warehouses.get(whName) || 0) + qty);
    const label = (row.warehouse_name ?? '').toString().trim();
    if (label && label.toUpperCase() !== whName.toUpperCase()) warehouseLabels.set(whName, label);
  }

  const matchedMasterIds = new Set();
  const results = [];
  const reported = new Map(); // part key -> { index in results, master item } for every matched report row

  for (const [key, { code, item: masterItem, matchedVia, warehouses }] of itemMap) {
    let currentStock = 0;
    const warehouseBreakdown = {};
    for (const [whName, qty] of warehouses) {
      const enabled = isWarehouseEnabled(whName, enabledWarehouses);
      warehouseBreakdown[whName] = { quantity: qty, enabled };
      const label = warehouseLabels.get(whName) || parseWarehouse(whName).name;
      if (label) warehouseBreakdown[whName].name = label;
      if (enabled) currentStock += qty;
    }

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
    reported.set(key, { index: results.length, masterItem });
    results.push(stockResult(code, masterItem, matchedVia, currentStock, warehouseBreakdown));
  }

  // Master items with a minimum stock that are absent from the report have zero stock.
  for (const mi of masterItems) {
    if (matchedMasterIds.has(mi.id)) continue;
    if ((Number(mi.minimum_stock) || 0) <= 0) continue;
    // The same part recorded twice in the master list (e.g. "D0066806" and "IMM0066806"): its stock is already
    // counted on the other record, so it is not "missing". The higher minimum stock of the two applies.
    const twin = reported.get(catalogCodeKey(mi.mediserv_item_code)) || reported.get(catalogCodeKey(mi.manufacturer_item_code));
    if (twin) {
      const r = results[twin.index];
      if (Number(mi.minimum_stock) > r.minimum_stock) {
        results[twin.index] = stockResult(r.item_code, { ...twin.masterItem, minimum_stock: mi.minimum_stock }, r.matched_via, r.current_stock, r.warehouse_breakdown);
      }
      continue;
    }
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