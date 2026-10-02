import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVendorSelection } from '@/hooks/useVendors';
import { fetchAll } from '@/lib/fetchAll';
import { computeConsumption } from '@/lib/consumptionFromRuns';
import { getCurrencySymbol } from '@/lib/partConstants';
import { TrendingDown, Wallet, CalendarRange, Package, Info } from 'lucide-react';
import moment from 'moment';

const RANGES = [
  { runs: 6, label: 'Last 6 reports' },
  { runs: 12, label: 'Last 12 reports' },
  { runs: 24, label: 'Last 24 reports' },
];
const ITEM_FIELDS = ['item_code', 'description', 'current_stock', 'unit_price', 'status'];
const BAR_COLOR = 'hsl(var(--accent))';

function useConsumption(vendorId, runCount) {
  return useQuery({
    queryKey: ['consumption', vendorId, runCount],
    enabled: !!vendorId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [runs, files] = await Promise.all([
        base44.entities.AnalysisRun.filter({ vendor_id: vendorId, status: 'completed' }, '-created_date', runCount),
        base44.entities.MasterFile.filter({ vendor_id: vendorId }, '-created_date', 1),
      ]);
      const runsWithItems = await Promise.all(
        runs.map(async run => ({
          run,
          items: await fetchAll(base44.entities.AnalysisItem, { analysis_run_id: run.id }, '-created_date', ITEM_FIELDS),
        }))
      );
      return { ...computeConsumption(runsWithItems), runCount: runs.length, currency: files[0]?.currency || 'SAR' };
    },
  });
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <Card className="p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold tabular-nums mt-1.5 break-words">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

function ChartTooltip({ active, payload, render }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md space-y-0.5">
      {render(payload[0].payload)}
    </div>
  );
}

export default function Consumption() {
  const { vendors, selectedVendor, setSelectedVendor } = useVendorSelection();
  const [runCount, setRunCount] = useState(12);
  const { data, isLoading, error } = useConsumption(selectedVendor, runCount);

  const symbol = getCurrencySymbol(data?.currency);
  const money = (n) => `${symbol} ${Math.round(n || 0).toLocaleString('en-US')}`;

  const periodData = useMemo(() => (data?.periods || []).map(p => ({
    ...p,
    label: moment(p.to).format('MMM D'),
  })), [data]);
  const topChart = useMemo(() => (data?.topParts || []).filter(p => p.value > 0).slice(0, 10), [data]);
  const lastIndex = periodData.length - 1;
  const missingPrices = (data?.topParts || []).filter(p => !p.unit_price).length;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <TrendingDown className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Consumption</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Value of parts consumed, from stock changes between your analysis reports</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="space-y-2 flex-1 max-w-md">
          <label className="text-sm font-medium">Vendor</label>
          <Select value={selectedVendor} onValueChange={setSelectedVendor}>
            <SelectTrigger><SelectValue placeholder="Choose a vendor..." /></SelectTrigger>
            <SelectContent>
              {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map(r => (
            <button
              key={r.runs}
              onClick={() => setRunCount(r.runs)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                runCount === r.runs ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!selectedVendor ? null : isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : error ? (
        <Card className="p-8 text-center text-sm text-critical">Failed to load consumption data.</Card>
      ) : data.runCount < 2 ? (
        <Card className="p-10 text-center shadow-sm">
          <CalendarRange className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Need at least 2 analysis reports</p>
          <p className="text-xs text-muted-foreground mt-1">Consumption is the drop in stock between two reports. Run another analysis with a newer stock report.</p>
          <Button asChild size="sm" className="mt-4"><Link to={`/analysis?vendor=${selectedVendor}`}>Go to Analysis</Link></Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={Wallet} label="Total consumed value" value={money(data.totalValue)} sub={`over ${data.totalDays} days`} />
            <Kpi icon={TrendingDown} label="Average per month" value={money(data.monthlyValue)} sub="based on the selected range" />
            <Kpi icon={Package} label="Units consumed" value={Math.round(data.totalQty).toLocaleString('en-US')} sub={`${data.topParts.length} different parts`} />
            <Kpi icon={CalendarRange} label="Reports compared" value={data.runCount} sub={`${data.periods.length} periods`} />
          </div>

          <Card className="p-4 sm:p-5 shadow-sm">
            <h3 className="font-semibold">Consumption value per period</h3>
            <p className="text-xs text-muted-foreground mb-4">Each bar = parts consumed between two reports, ending on that date</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : v} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    content={<ChartTooltip render={(p) => (
                      <>
                        <p className="font-semibold">{moment(p.from).format('MMM D')} → {moment(p.to).format('MMM D, YYYY')}</p>
                        <p>Consumed: <span className="font-semibold">{money(p.value)}</span></p>
                        <p className="text-muted-foreground">{Math.round(p.qty).toLocaleString('en-US')} units · {p.days} days</p>
                        {p.restockedQty > 0 && <p className="text-muted-foreground">Restocked: {Math.round(p.restockedQty).toLocaleString('en-US')} units</p>}
                      </>
                    )} />}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}
                    label={({ x, y, width, index, value }) => index === lastIndex ? (
                      <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(var(--foreground))">
                        {money(value)}
                      </text>
                    ) : null}
                  >
                    {periodData.map((p, i) => <Cell key={i} fill={BAR_COLOR} fillOpacity={i === lastIndex ? 1 : 0.75} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="p-4 sm:p-5 shadow-sm lg:col-span-3">
              <h3 className="font-semibold">Top 10 parts by consumed value</h3>
              <p className="text-xs text-muted-foreground mb-4">Over the selected range</p>
              {topChart.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No priced consumption in this range.</p>
              ) : (
                <div style={{ height: Math.max(160, topChart.length * 34) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topChart} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }} barCategoryGap="20%">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="code" width={96} tickLine={false} axisLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--foreground))', fontFamily: 'var(--font-mono)' }} />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        content={<ChartTooltip render={(p) => (
                          <>
                            <p className="font-semibold font-mono">{p.code}</p>
                            {p.description && <p className="text-muted-foreground max-w-[220px]">{p.description}</p>}
                            <p>Consumed: <span className="font-semibold">{money(p.value)}</span></p>
                            <p className="text-muted-foreground">{Math.round(p.qty)} units × {money(p.unit_price)}</p>
                          </>
                        )} />}
                      />
                      <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} maxBarSize={22}
                        label={{ position: 'right', fontSize: 11, fill: 'hsl(var(--muted-foreground))', formatter: (v) => money(v) }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="shadow-sm lg:col-span-2 overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold">All consumed parts</h3>
                <p className="text-xs text-muted-foreground">{data.topParts.length} parts</p>
              </div>
              <div className="overflow-auto max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Part</th>
                      <th className="text-right px-2 py-2 font-medium">Units</th>
                      <th className="text-right px-4 py-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.topParts.map(p => (
                      <tr key={p.code} className="hover:bg-muted/40">
                        <td className="px-4 py-2 max-w-[180px]">
                          <p className="font-mono text-xs font-semibold truncate">{p.code}</p>
                          {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{Math.round(p.qty)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium">{p.unit_price ? money(p.value) : <span className="text-muted-foreground">no price</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Consumption = drop in stock between consecutive reports, valued at the master-file unit price.
              When stock goes up (a delivery), that period counts as 0 for the part, so consumption in the same period as a delivery is not visible.
              {missingPrices > 0 && ` ${missingPrices} consumed parts have no unit price and are not included in the value.`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
