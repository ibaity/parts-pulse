export function daysBetween(dateA, dateB) {
  const ms = new Date(dateA) - new Date(dateB);
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function calculateConsumption(stockRecords, snapshots) {
  if (!snapshots || snapshots.length < 2) return [];

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.snapshot_date) - new Date(a.snapshot_date)
  );
  const latest = sorted[0];
  const previous = sorted[1];

  const latestMap = new Map();
  const prevMap = new Map();

  for (const r of stockRecords) {
    const code = (r.item_code || '').trim().toLowerCase();
    if (!code) continue;
    if (r.snapshot_id === latest.id) latestMap.set(code, r);
    if (r.snapshot_id === previous.id) prevMap.set(code, r);
  }

  const diff = daysBetween(latest.snapshot_date, previous.snapshot_date);

  const results = [];
  for (const [code, latestRec] of latestMap) {
    const prevRec = prevMap.get(code);
    const prevQty = prevRec ? Number(prevRec.quantity) || 0 : null;
    const currentQty = Number(latestRec.quantity) || 0;

    let consumed = null;
    let dailyRate = 0;
    let monthlyEst = 0;
    let yearlyEst = 0;
    let daysUntilDepletion = null;
    let status = 'no_data';

    if (prevQty !== null) {
      consumed = prevQty - currentQty;
      dailyRate = consumed / diff;
      monthlyEst = dailyRate * 30;
      yearlyEst = dailyRate * 365;

      if (dailyRate > 0) {
        daysUntilDepletion = Math.round(currentQty / dailyRate);
        if (daysUntilDepletion <= 30) status = 'critical';
        else if (daysUntilDepletion <= 90) status = 'low';
        else status = 'ok';
      } else if (consumed < 0) {
        status = 'restocked';
      } else {
        status = 'stable';
      }
    }

    results.push({
      item_code: latestRec.item_code,
      description: latestRec.description || (prevRec && prevRec.description) || '',
      prev_qty: prevQty,
      current_qty: currentQty,
      consumed,
      days_diff: diff,
      daily_rate: dailyRate,
      monthly_est: monthlyEst,
      yearly_est: yearlyEst,
      days_until_depletion: daysUntilDepletion,
      status,
    });
  }

  return results.sort((a, b) => (b.yearly_est || 0) - (a.yearly_est || 0));
}

export const STATUS_STYLES = {
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700' },
  low: { label: 'Low', className: 'bg-amber-100 text-amber-700' },
  ok: { label: 'OK', className: 'bg-green-100 text-green-700' },
  restocked: { label: 'Restocked', className: 'bg-blue-100 text-blue-700' },
  stable: { label: 'Stable', className: 'bg-slate-100 text-slate-600' },
  no_data: { label: 'No Data', className: 'bg-muted text-muted-foreground' },
};