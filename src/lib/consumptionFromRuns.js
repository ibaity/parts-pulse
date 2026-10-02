import { normalizeCode } from '@/lib/analysisUtils';

const DAY = 86400000;

// Each completed analysis run is a stock snapshot. Between two consecutive runs,
// consumption = drop in stock. A rise means a restock, so it counts as 0 consumed
// (consumption that happened in the same period as a restock can't be seen).
export function computePeriods(runsWithItems) {
  const runs = [...runsWithItems].sort((a, b) => new Date(a.run.created_date) - new Date(b.run.created_date));
  const priceByCode = new Map();
  const infoByCode = new Map();
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
    periods.push({
      from: new Date(runs[i - 1].run.created_date).getTime(),
      to: new Date(runs[i].run.created_date).getTime(),
      parts,
      restockedQty,
    });
  }
  return { periods, priceByCode, infoByCode };
}

// Spreads each period's consumption over calendar months in proportion to the days
// it covers, so a period from Jan 20 to Feb 10 is split between January and February.
export function allocateByMonth({ periods, priceByCode, infoByCode }, year) {
  const months = Array.from({ length: 12 }, (_, m) => ({
    month: m,
    value: 0,
    qty: 0,
    coveredDays: 0,
    daysInMonth: new Date(year, m + 1, 0).getDate(),
    parts: new Map(),
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

  const covered = months.filter(m => m.coveredDays > 0);
  const totalValue = months.reduce((s, m) => s + m.value, 0);
  // Average per month of actual coverage (partly covered months count partly).
  const coveredMonthEquivalents = months.reduce((s, m) => s + m.coveredDays / m.daysInMonth, 0);
  return {
    months: months.map(m => ({ ...m, hasData: m.coveredDays > 0, partRows: toRows(m.parts) })),
    yearParts: toRows(yearParts),
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
