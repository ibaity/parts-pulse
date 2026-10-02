import { normalizeCode, isEngineerWarehouse, parseWarehouse } from '@/lib/analysisUtils';

export { isEngineerWarehouse };

const DAY = 86400000;


function addTo(map, key, qty, value) {
  const t = map.get(key) || { qty: 0, value: 0 };
  t.qty += qty;
  t.value += value;
  map.set(key, t);
}

// Each completed analysis run is a stock snapshot. Between two consecutive runs,
// consumption = drop in stock. A rise means a restock, so it counts as 0 consumed
// (consumption that happened in the same period as a restock can't be seen).
export function computePeriods(runsWithItems) {
  const runs = [...runsWithItems].sort((a, b) => new Date(a.run.created_date) - new Date(b.run.created_date));
  const priceByCode = new Map();
  const infoByCode = new Map();
  // Per item: stock in each warehouse (all warehouses, enabled or not).
  // Engineer locations are keyed by their code (E101) so a name added later still groups with history.
  const warehouseLabels = new Map();
  const whMaps = runs.map(({ items }) => {
    const map = new Map();
    for (const it of items) {
      if (it.status === 'unknown') continue;
      const code = normalizeCode(it.item_code);
      if (!code) continue;
      const byWh = new Map();
      for (const [name, info] of Object.entries(it.warehouse_breakdown || {})) {
        const { key, name: parsedName } = parseWarehouse(name);
        byWh.set(key, (byWh.get(key) || 0) + (Number(info?.quantity) || 0));
        const label = info?.name || parsedName;
        if (label) warehouseLabels.set(key, label);
      }
      map.set(code, byWh);
    }
    return map;
  });
  const stockMaps = runs.map(({ items }) => {
    const map = new Map();
    for (const it of items) {
      if (it.status === 'unknown') continue;
      const code = normalizeCode(it.item_code);
      if (!code) continue;
      map.set(code, Number(it.current_stock) || 0);
      if (Number(it.unit_price) > 0) priceByCode.set(code, Number(it.unit_price));
      if (!infoByCode.has(code) || it.description) infoByCode.set(code, { code: it.item_code, description: it.description || '' });
    }
    return map;
  });

  const periods = [];
  for (let i = 1; i < runs.length; i++) {
    const prev = stockMaps[i - 1];
    const curr = stockMaps[i];
    const parts = new Map();
    let restockedQty = 0;
    for (const [code, prevQty] of prev) {
      if (!curr.has(code)) continue;
      const diff = prevQty - curr.get(code);
      if (diff < 0) restockedQty += -diff;
      if (diff <= 0) continue;
      parts.set(code, { qty: diff, value: diff * (priceByCode.get(code) || 0) });
    }

    // Same calculation per warehouse. A transfer out of a warehouse shows as its consumption.
    const warehouses = new Map(); // wh -> Map(code -> { qty, value })
    for (const [code, prevWh] of whMaps[i - 1]) {
      const currWh = whMaps[i].get(code);
      if (!currWh) continue;
      const price = priceByCode.get(code) || 0;
      for (const wh of new Set([...prevWh.keys(), ...currWh.keys()])) {
        const diff = (prevWh.get(wh) || 0) - (currWh.get(wh) || 0);
        if (diff <= 0) continue;
        if (!warehouses.has(wh)) warehouses.set(wh, new Map());
        warehouses.get(wh).set(code, { qty: diff, value: diff * price });
      }
    }
    periods.push({
      from: new Date(runs[i - 1].run.created_date).getTime(),
      to: new Date(runs[i].run.created_date).getTime(),
      parts,
      warehouses,
      restockedQty,
    });
  }
  return { periods, priceByCode, infoByCode, warehouseLabels };
}

// Spreads each period's consumption over calendar months in proportion to the days
// it covers, so a period from Jan 20 to Feb 10 is split between January and February.
export function allocateByMonth({ periods, priceByCode, infoByCode, warehouseLabels = new Map() }, year) {
  const months = Array.from({ length: 12 }, (_, m) => ({
    month: m,
    value: 0,
    qty: 0,
    coveredDays: 0,
    daysInMonth: new Date(year, m + 1, 0).getDate(),
    parts: new Map(),
    warehouses: new Map(), // wh -> { qty, value, parts: Map }
  }));

  for (const p of periods) {
    const span = p.to - p.from;
    if (span <= 0) continue;
    for (const month of months) {
      const start = new Date(year, month.month, 1).getTime();
      const end = new Date(year, month.month + 1, 1).getTime();
      const overlap = Math.min(end, p.to) - Math.max(start, p.from);
      if (overlap <= 0) continue;
      const share = overlap / span;
      month.coveredDays += overlap / DAY;
      for (const [code, part] of p.parts) {
        const target = month.parts.get(code) || { qty: 0, value: 0 };
        target.qty += part.qty * share;
        target.value += part.value * share;
        month.parts.set(code, target);
        month.qty += part.qty * share;
        month.value += part.value * share;
      }
      for (const [wh, whParts] of p.warehouses) {
        if (!month.warehouses.has(wh)) month.warehouses.set(wh, { qty: 0, value: 0, parts: new Map() });
        const target = month.warehouses.get(wh);
        for (const [code, part] of whParts) {
          target.qty += part.qty * share;
          target.value += part.value * share;
          addTo(target.parts, code, part.qty * share, part.value * share);
        }
      }
    }
  }

  const toRows = (partsMap) => [...partsMap.entries()]
    .map(([code, p]) => ({ ...infoByCode.get(code), qty: p.qty, value: p.value, unit_price: priceByCode.get(code) || 0 }))
    .sort((a, b) => (b.value - a.value) || (b.qty - a.qty));

  const yearParts = new Map();
  for (const m of months) {
    for (const [code, p] of m.parts) {
      const t = yearParts.get(code) || { qty: 0, value: 0 };
      t.qty += p.qty;
      t.value += p.value;
      yearParts.set(code, t);
    }
  }

  const toWarehouseRows = (whMap) => [...whMap.entries()]
    .map(([name, w]) => {
      const label = warehouseLabels.get(name) || '';
      return {
        name,
        label,
        display: label ? `${name} · ${label}` : name,
        engineer: isEngineerWarehouse(name),
        qty: w.qty,
        value: w.value,
        partRows: toRows(w.parts),
      };
    })
    .sort((a, b) => (b.value - a.value) || (b.qty - a.qty));

  const yearWarehouses = new Map();
  for (const m of months) {
    for (const [wh, w] of m.warehouses) {
      if (!yearWarehouses.has(wh)) yearWarehouses.set(wh, { qty: 0, value: 0, parts: new Map() });
      const t = yearWarehouses.get(wh);
      t.qty += w.qty;
      t.value += w.value;
      for (const [code, part] of w.parts) addTo(t.parts, code, part.qty, part.value);
    }
  }

  const covered = months.filter(m => m.coveredDays > 0);
  const totalValue = months.reduce((s, m) => s + m.value, 0);
  // Average per month of actual coverage (partly covered months count partly).
  const coveredMonthEquivalents = months.reduce((s, m) => s + m.coveredDays / m.daysInMonth, 0);
  return {
    months: months.map(m => ({ ...m, hasData: m.coveredDays > 0, partRows: toRows(m.parts), warehouseRows: toWarehouseRows(m.warehouses) })),
    yearParts: toRows(yearParts),
    yearWarehouses: toWarehouseRows(yearWarehouses),
    totalValue,
    totalQty: months.reduce((s, m) => s + m.qty, 0),
    coveredMonths: covered.length,
    monthlyAverage: coveredMonthEquivalents > 0 ? totalValue / coveredMonthEquivalents : 0,
  };
}

// Years that have at least one consumption period overlapping them.
export function yearsWithData(periods) {
  const years = new Set();
  for (const p of periods) {
    for (let y = new Date(p.from).getFullYear(); y <= new Date(p.to).getFullYear(); y++) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}
