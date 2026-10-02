import { normalizeCode } from '@/lib/analysisUtils';

// Each completed analysis run is a stock snapshot. Between two consecutive runs,
// consumption = drop in stock. A rise means a restock, so it counts as 0 consumed
// (consumption that happened in the same period as a restock can't be seen).
export function computeConsumption(runsWithItems) {
  const runs = [...runsWithItems].sort((a, b) => new Date(a.run.created_date) - new Date(b.run.created_date));
  const priceByCode = new Map();
  const descByCode = new Map();
  const stockMaps = runs.map(({ items }) => {
    const map = new Map();
    for (const it of items) {
      if (it.status === 'unknown') continue;
      const code = normalizeCode(it.item_code);
      if (!code) continue;
      map.set(code, Number(it.current_stock) || 0);
      if (Number(it.unit_price) > 0) priceByCode.set(code, Number(it.unit_price));
      if (!descByCode.has(code) || it.description) descByCode.set(code, { code: it.item_code, description: it.description || '' });
    }
    return map;
  });

  const periods = [];
  const parts = new Map();
  for (let i = 1; i < runs.length; i++) {
    const prev = stockMaps[i - 1];
    const curr = stockMaps[i];
    let value = 0;
    let qty = 0;
    let restockedQty = 0;
    for (const [code, prevQty] of prev) {
      if (!curr.has(code)) continue;
      const diff = prevQty - curr.get(code);
      if (diff < 0) { restockedQty += -diff; continue; }
      if (diff === 0) continue;
      const price = priceByCode.get(code) || 0;
      qty += diff;
      value += diff * price;
      const p = parts.get(code) || { qty: 0, value: 0 };
      p.qty += diff;
      p.value += diff * price;
      parts.set(code, p);
    }
    const from = runs[i - 1].run.created_date;
    const to = runs[i].run.created_date;
    periods.push({
      from,
      to,
      days: Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000)),
      value,
      qty,
      restockedQty,
    });
  }

  const topParts = [...parts.entries()]
    .map(([code, p]) => ({
      ...descByCode.get(code),
      qty: p.qty,
      value: p.value,
      unit_price: priceByCode.get(code) || 0,
    }))
    .sort((a, b) => (b.value - a.value) || (b.qty - a.qty));

  const totalValue = periods.reduce((s, p) => s + p.value, 0);
  const totalQty = periods.reduce((s, p) => s + p.qty, 0);
  const totalDays = periods.reduce((s, p) => s + p.days, 0);
  return {
    periods,
    topParts,
    totalValue,
    totalQty,
    totalDays,
    monthlyValue: totalDays > 0 ? (totalValue / totalDays) * 30 : 0,
  };
}
