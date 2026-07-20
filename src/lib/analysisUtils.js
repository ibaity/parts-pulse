export function normalizeName(name) {
  return (name || '').toLowerCase().trim();
}

export function isWarehouseEnabled(warehouseName, enabledWarehouses) {
  const normalized = normalizeName(warehouseName);
  if (!normalized) return false;
  return enabledWarehouses.some(wh => {
    const whName = normalizeName(wh.name);
    const whCode = normalizeName(wh.code);
    if (!whName && !whCode) return false;
    const nameMatch = whName && (whName === normalized || whName.includes(normalized) || normalized.includes(whName));
    const codeMatch = whCode && (whCode === normalized || whCode.includes(normalized) || normalized.includes(whCode));
    return nameMatch || codeMatch;
  });
}

export function matchMasterItem(itemCode, masterItems) {
  const code = normalizeName(itemCode);
  if (!code) return { item: null, matchedVia: 'none' };

  let match = masterItems.find(mi => normalizeName(mi.mediserv_item_code) === code);
  if (match) return { item: match, matchedVia: 'mediserv_code' };

  match = masterItems.find(mi => normalizeName(mi.manufacturer_item_code) === code);
  if (match) return { item: match, matchedVia: 'manufacturer_code' };

  return { item: null, matchedVia: 'none' };
}

export function runAnalysis(pdfItems, masterItems, enabledWarehouses) {
  const itemMap = new Map();

  for (const pdfItem of pdfItems) {
    const code = (pdfItem.item_code || '').trim();
    if (!code) continue;

    if (!itemMap.has(code)) {
      itemMap.set(code, { warehouses: new Map() });
    }

    const whName = pdfItem.warehouse || 'Unknown';
    const qty = Number(pdfItem.quantity) || 0;
    const current = itemMap.get(code).warehouses.get(whName) || 0;
    itemMap.get(code).warehouses.set(whName, current + qty);
  }

  const results = [];

  for (const [itemCode, data] of itemMap) {
    let currentStock = 0;
    const warehouseBreakdown = {};

    for (const [whName, qty] of data.warehouses) {
      const isEnabled = isWarehouseEnabled(whName, enabledWarehouses);
      warehouseBreakdown[whName] = { quantity: qty, enabled: isEnabled };
      if (isEnabled) currentStock += qty;
    }

    const { item: masterItem, matchedVia } = matchMasterItem(itemCode, masterItems);

    if (!masterItem) {
      results.push({
        item_code: itemCode,
        description: '',
        current_stock: currentStock,
        minimum_stock: 0,
        recommended_quantity: 0,
        status: 'unknown',
        matched_via: 'none',
        warehouse_breakdown: warehouseBreakdown,
      });
    } else {
      const minStock = Number(masterItem.minimum_stock) || 0;
      if (currentStock < minStock) {
        results.push({
          item_code: itemCode,
          description: masterItem.description || '',
          current_stock: currentStock,
          minimum_stock: minStock,
          recommended_quantity: minStock - currentStock,
          unit_price: Number(masterItem.unit_price) || 0,
          status: currentStock === 0 ? 'critical' : 'low',
          matched_via: matchedVia,
          warehouse_breakdown: warehouseBreakdown,
        });
      }
    }
  }

  const summary = {
    total_items: itemMap.size,
    items_to_purchase: results.filter(r => r.status !== 'unknown').length,
    critical_items: results.filter(r => r.status === 'critical').length,
    unknown_items: results.filter(r => r.status === 'unknown').length,
  };

  return { results, summary };
}