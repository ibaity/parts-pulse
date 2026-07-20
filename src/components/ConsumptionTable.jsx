import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { STATUS_STYLES } from '@/lib/consumptionUtils';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/table/SortHeader';

export default function ConsumptionTable({ data }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(i =>
      (i.item_code || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered);

  const fmt = (n, decimals = 0) => {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals });
  };

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by code or description..."
          className="pl-9 h-9"
        />
      </div>

      <div className="overflow-auto max-h-[600px] border rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 backdrop-blur-sm sticky top-0 z-10 border-b">
            <tr>
              <SortHeader label="Item Code" sortKey="item_code" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
              <SortHeader label="Description" sortKey="description" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
              <SortHeader label="Prev Qty" sortKey="prev_qty" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
              <SortHeader label="Current Qty" sortKey="current_qty" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
              <SortHeader label="Consumed" sortKey="consumed" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
              <SortHeader label="Days" sortKey="days_diff" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
              <SortHeader label="Daily Rate" sortKey="daily_rate" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
              <SortHeader label="Monthly Est." sortKey="monthly_est" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
              <SortHeader label="Yearly Est." sortKey="yearly_est" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
              <SortHeader label="Depletion" sortKey="days_until_depletion" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
              <th className="text-center p-2 font-medium whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => {
              const style = STATUS_STYLES[item.status] || STATUS_STYLES.no_data;
              const consumedIcon = item.consumed > 0
                ? <TrendingDown className="w-3 h-3 inline mr-1 text-red-500" />
                : item.consumed < 0
                  ? <TrendingUp className="w-3 h-3 inline mr-1 text-blue-500" />
                  : item.consumed === 0
                    ? <Minus className="w-3 h-3 inline mr-1 text-slate-400" />
                    : null;
              return (
                <tr key={i} className="border-b hover:bg-muted/40">
                  <td className="p-2 font-mono text-xs whitespace-nowrap">{item.item_code}</td>
                  <td className="p-2 text-xs max-w-[200px] truncate">{item.description || '—'}</td>
                  <td className="p-2 text-right text-xs">{fmt(item.prev_qty)}</td>
                  <td className="p-2 text-right text-xs font-medium">{fmt(item.current_qty)}</td>
                  <td className={`p-2 text-right text-xs font-medium ${item.consumed > 0 ? 'text-red-600' : item.consumed < 0 ? 'text-blue-600' : ''}`}>
                    {consumedIcon}{fmt(item.consumed)}
                  </td>
                  <td className="p-2 text-right text-xs text-muted-foreground">{item.days_diff}</td>
                  <td className="p-2 text-right text-xs">{fmt(item.daily_rate, 1)}</td>
                  <td className="p-2 text-right text-xs">{fmt(item.monthly_est, 1)}</td>
                  <td className="p-2 text-right text-xs font-semibold text-primary">{fmt(item.yearly_est, 1)}</td>
                  <td className="p-2 text-right text-xs">
                    {item.days_until_depletion !== null
                      ? `${item.days_until_depletion}d`
                      : '—'}
                  </td>
                  <td className="p-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${style.className}`}>
                      {style.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No items match your search.</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {sorted.length} items · Consumption = Prev Qty − Current Qty · Yearly Est. = Daily Rate × 365
      </p>
    </div>
  );
}