import { useEffect, useMemo, useState } from 'react';
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
import { computePeriods, allocateByMonth, yearsWithData } from '@/lib/consumptionFromRuns';
import { getCurrencySymbol } from '@/lib/partConstants';
import { TrendingDown, Wallet, CalendarRange, Package, Info, X, HardHat, Warehouse as WarehouseIcon } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import moment from 'moment';

const ITEM_FIELDS = ['item_code', 'description', 'current_stock', 'unit_price', 'status', 'warehouse_breakdown'];
const BAR_COLOR = 'hsl(var(--accent))';
const MONTHS = moment.monthsShort();
const MONTHS_LONG = moment.months();

// Light list of completed runs + currency; years are derived from the run dates.
function useRunIndex(vendorId) {
  return useQuery({
    queryKey: ['consumption-runs', vendorId],
    enabled: !!vendorId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [runs, files] = await Promise.all([
        base44.entities.AnalysisRun.filter({ vendor_id: vendorId, status: 'completed' }, '-created_date', 200),
        base44.entities.MasterFile.filter({ vendor_id: vendorId }, '-created_date', 1),
      ]);
      const sorted = [...runs].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const pairs = sorted.slice(1).map((r, i) => ({ from: new Date(sorted[i].created_date).getTime(), to: new Date(r.created_date).getTime() }));
      return { runs: sorted, years: yearsWithData(pairs), currency: files[0]?.currency || 'SAR' };
    },
  });
}

// Loads stock items only for the runs whose periods touch the selected year.
function useYearConsumption(vendorId, runIndex, year) {
  return useQuery({
    queryKey: ['consumption-year', vendorId, year, runIndex?.runs.map(r => r.id).join(',')],
    enabled: !!vendorId && !!runIndex && !!year,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const start = new Date(year, 0, 1).getTime();
      const end = new Date(year + 1, 0, 1).getTime();
      const runs = runIndex.runs;
      const time = (r) => new Date(r.created_date).getTime();
      const lastBefore = runs.filter(r => time(r) < start).pop();
      const firstAfter = runs.find(r => time(r) >= end);
      const selected = [lastBefore, ...runs.filter(r => time(r) >= start && time(r) < end), firstAfter].filter(Boolean);
      const runsWithItems = await Promise.all(selected.map(async run => ({
        run,
        items: await fetchAll(base44.entities.AnalysisItem, { analysis_run_id: run.id }, '-created_date', ITEM_FIELDS),
      })));
      return allocateByMonth(computePeriods(runsWithItems), year);
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

// Two-line Y-axis label: code on the first line, its name below (part description or engineer name).
function PartTick({ x, y, payload, index, rows, subKey = 'description' }) {
  const desc = rows?.[index]?.[subKey] || '';
  const short = desc.length > 30 ? `${desc.slice(0, 29)}…` : desc;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{desc ? `${payload.value} — ${desc}` : payload.value}</title>
      <text x={-8} y={short ? -3 : 4} textAnchor="end" fontSize={11} fontWeight={600} fontFamily="var(--font-mono)" fill="hsl(var(--foreground))">
        {payload.value}
      </text>
      {short && (
        <text x={-8} y={11} textAnchor="end" fontSize={10.5} fill="hsl(var(--muted-foreground))">{short}</text>
      )}
    </g>
  );
}

function ChartTooltip({ active, payload, render }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md space-y-0.5">{render(payload[0].payload)}</div>;
}

export default function Consumption() {
  const { vendors, selectedVendor, setSelectedVendor } = useVendorSelection();
  const [year, setYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [whView, setWhView] = useState('engineers');
  const [selectedWh, setSelectedWh] = useState(null);
  const runIndex = useRunIndex(selectedVendor);
  const years = runIndex.data?.years || [];

  // Default to the current year, or the latest year that has data.
  useEffect(() => {
    if (!years.length) return;
    if (!years.includes(year)) {
      const current = new Date().getFullYear();
      setYear(years.includes(current) ? current : years[0]);
    }
  }, [years, year]);
  useEffect(() => { setSelectedMonth(null); setSelectedWh(null); }, [selectedVendor, year]);

  const yearData = useYearConsumption(selectedVendor, runIndex.data, year);
  const data = yearData.data;
  const symbol = getCurrencySymbol(runIndex.data?.currency);
  const money = (n) => `${symbol} ${Math.round(n || 0).toLocaleString('en-US')}`;
  const units = (n) => Math.round(n || 0).toLocaleString('en-US');

  const chartData = useMemo(() => (data?.months || []).map(m => ({
    ...m,
    label: MONTHS[m.month],
    value: m.hasData ? m.value : null,
  })), [data]);

  const month = selectedMonth !== null ? data?.months[selectedMonth] : null;
  const warehouseRows = (month ? month.warehouseRows : data?.yearWarehouses) || [];
  const engineerRows = warehouseRows.filter(w => w.engineer);
  const otherRows = warehouseRows.filter(w => !w.engineer);
  const shownWhRows = whView === 'engineers' ? engineerRows : otherRows;
  const whChart = shownWhRows.filter(w => w.value > 0).slice(0, 15);
  const activeWh = selectedWh ? warehouseRows.find(w => w.name === selectedWh) : null;
  const partRows = activeWh ? activeWh.partRows : month ? month.partRows : data?.yearParts || [];
  const scopeLabel = `${activeWh ? `${activeWh.display} · ` : ''}${month ? `${MONTHS_LONG[month.month]} ${year}` : `Whole year ${year}`}`;
  const topChart = partRows.filter(p => p.value > 0).slice(0, 10);
  const maxMonthValue = Math.max(0, ...(data?.months || []).map(m => m.value));
  const loading = runIndex.isLoading || (yearData.isLoading && !!year);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl">
      <PageHeader icon={TrendingDown} title="Consumption" subtitle="Yearly and monthly value of parts consumed, from stock changes between your analysis reports" />

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
        {years.length > 0 && (
          <div className="space-y-2 w-36">
            <label className="text-sm font-medium">Year</label>
            <Select value={year ? String(year) : undefined} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!selectedVendor ? null : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : runIndex.error || yearData.error ? (
        <Card className="p-8 text-center text-sm text-critical">Failed to load consumption data.</Card>
      ) : !years.length || !data ? (
        <Card className="p-10 text-center shadow-sm">
          <CalendarRange className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Need at least 2 analysis reports</p>
          <p className="text-xs text-muted-foreground mt-1">Consumption is the drop in stock between two reports. Run another analysis with a newer stock report.</p>
          <Button asChild size="sm" className="mt-4"><Link to={`/analysis?vendor=${selectedVendor}`}>Go to Analysis</Link></Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={Wallet} label={`Total consumed in ${year}`} value={money(data.totalValue)} sub={`${data.coveredMonths} of 12 months with data`} />
            <Kpi icon={TrendingDown} label="Average per month" value={money(data.monthlyAverage)} sub="months with report data" />
            <Kpi icon={Package} label="Units consumed" value={units(data.totalQty)} sub={`${data.yearParts.length} different parts`} />
            <Kpi
              icon={CalendarRange}
              label="Highest month"
              value={maxMonthValue > 0 ? MONTHS_LONG[data.months.findIndex(m => m.value === maxMonthValue)] : '-'}
              sub={maxMonthValue > 0 ? money(maxMonthValue) : undefined}
            />
          </div>

          <Card className="p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Monthly consumption · {year}</h3>
                <p className="text-xs text-muted-foreground mb-4">Click a month to see its parts</p>
              </div>
              {selectedMonth !== null && (
                <Button size="sm" variant="outline" onClick={() => setSelectedMonth(null)}>
                  <X className="w-3.5 h-3.5 mr-1" />Whole year
                </Button>
              )}
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval={0}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : v} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    content={<ChartTooltip render={(m) => (
                      <>
                        <p className="font-semibold">{MONTHS_LONG[m.month]} {year}</p>
                        {m.hasData ? (
                          <>
                            <p>Consumed: <span className="font-semibold">{money(m.value)}</span></p>
                            <p className="text-muted-foreground">{units(m.qty)} units</p>
                            {Math.round(m.coveredDays) < m.daysInMonth && (
                              <p className="text-muted-foreground">Data covers {Math.round(m.coveredDays)} of {m.daysInMonth} days</p>
                            )}
                          </>
                        ) : (
                          <p className="text-muted-foreground">No report data for this month</p>
                        )}
                      </>
                    )} />}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44} className="cursor-pointer"
                    onClick={(d) => d?.hasData && setSelectedMonth(prev => prev === d.month ? null : d.month)}>
                    {chartData.map(m => (
                      <Cell key={m.month} fill={BAR_COLOR}
                        fillOpacity={selectedMonth === null || selectedMonth === m.month ? 1 : 0.35} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {data.months.map(m => (
                <button
                  key={m.month}
                  disabled={!m.hasData}
                  onClick={() => setSelectedMonth(prev => prev === m.month ? null : m.month)}
                  className={`text-left p-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-default ${
                    selectedMonth === m.month ? 'border-accent bg-accent/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <p className="text-[11px] text-muted-foreground">{MONTHS_LONG[m.month]}</p>
                  <p className="text-sm font-semibold tabular-nums">{m.hasData ? money(m.value) : '—'}</p>
                  <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${maxMonthValue ? (m.value / maxMonthValue) * 100 : 0}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div>
                <h3 className="font-semibold">Who consumes the most</h3>
                <p className="text-xs text-muted-foreground">
                  {month ? `${MONTHS_LONG[month.month]} ${year}` : `Whole year ${year}`} · click a bar to see that location&apos;s parts
                </p>
              </div>
              <div className="flex gap-1.5 sm:ml-auto">
                {[
                  { key: 'engineers', label: `Engineers (${engineerRows.length})`, icon: HardHat },
                  { key: 'warehouses', label: `Warehouses (${otherRows.length})`, icon: WarehouseIcon },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setWhView(t.key); setSelectedWh(null); }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      whView === t.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'
                    }`}
                  >
                    <t.icon className="w-3.5 h-3.5" />{t.label}
                  </button>
                ))}
              </div>
            </div>

            {whChart.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                {whView === 'engineers' ? 'No consumption found in engineer warehouses (E…) for this period.' : 'No consumption found in other warehouses for this period.'}
              </p>
            ) : (
              <div className="mt-4" style={{ height: Math.max(160, whChart.length * 34) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={whChart} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }} barCategoryGap="20%">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={170} tickLine={false} axisLine={false}
                      tick={<PartTick rows={whChart} subKey="label" />} />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      content={<ChartTooltip render={(w) => (
                        <>
                          <p className="font-semibold"><span className="font-mono">{w.name}</span>{w.label && ` · ${w.label}`}</p>
                          <p>Consumed: <span className="font-semibold">{money(w.value)}</span></p>
                          <p className="text-muted-foreground">{units(w.qty)} units · {w.partRows.length} parts</p>
                        </>
                      )} />}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22} className="cursor-pointer"
                      onClick={(w) => w?.name && setSelectedWh(prev => prev === w.name ? null : w.name)}
                      label={{ position: 'right', fontSize: 11, fill: 'hsl(var(--muted-foreground))', formatter: (v) => money(v) }}>
                      {whChart.map(w => (
                        <Cell key={w.name} fill={BAR_COLOR} fillOpacity={!selectedWh || selectedWh === w.name ? 1 : 0.35} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeWh && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-md bg-accent/10 text-accent font-medium"><span className="font-mono">{activeWh.name}</span>{activeWh.label && ` · ${activeWh.label}`}</span>
                <span className="text-muted-foreground"><bdi>{money(activeWh.value)}</bdi> · {units(activeWh.qty)} units — parts shown below</span>
                <button onClick={() => setSelectedWh(null)} className="ml-auto text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <X className="w-3.5 h-3.5" />Clear
                </button>
              </div>
            )}
            {whView === 'warehouses' && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Transfers count as consumption of the sending warehouse — a main store that supplies engineers will rank high here.
              </p>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="p-4 sm:p-5 shadow-sm lg:col-span-3">
              <h3 className="font-semibold">Top 10 parts by consumed value</h3>
              <p className="text-xs text-muted-foreground mb-4">{scopeLabel}</p>
              {topChart.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No priced consumption in this period.</p>
              ) : (
                <div style={{ height: Math.max(180, topChart.length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topChart} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }} barCategoryGap="22%">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="code" width={190} tickLine={false} axisLine={false}
                        tick={<PartTick rows={topChart} />} />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))' }}
                        content={<ChartTooltip render={(p) => (
                          <>
                            <p className="font-semibold font-mono">{p.code}</p>
                            {p.description && <p className="text-muted-foreground max-w-[220px]">{p.description}</p>}
                            <p>Consumed: <span className="font-semibold">{money(p.value)}</span></p>
                            <p className="text-muted-foreground">{units(p.qty)} units × {money(p.unit_price)}</p>
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
                <h3 className="font-semibold">Consumed parts</h3>
                <p className="text-xs text-muted-foreground">{partRows.length} parts · {scopeLabel}</p>
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
                    {partRows.map(p => (
                      <tr key={p.code} className="hover:bg-muted/40">
                        <td className="px-4 py-2 max-w-[180px]">
                          <p className="font-mono text-xs font-semibold truncate">{p.code}</p>
                          {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{units(p.qty)}</td>
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
              A period that spans two months is split between them by number of days.
              When stock goes up (a delivery), that period counts as 0 for the part.
              {partRows.some(p => !p.unit_price) && ' Parts without a unit price are counted in units but not in value.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
