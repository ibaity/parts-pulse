import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Download, PackageX, CheckCircle2, FileSpreadsheet, FileText, ChevronDown, Search, ArrowRight,
  ArrowUpDown, ArrowUp, ArrowDown, ShoppingCart, AlertTriangle, EyeOff, Wallet,
} from 'lucide-react';
import { getCurrencySymbol } from '@/lib/partConstants';
import { isMissingFromReport } from '@/lib/analysisUtils';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'low', label: 'Low' },
  { key: 'missing', label: 'Not in report' },
];

const STATUS_ORDER = { critical: 0, low: 1 };

const COLUMNS = [
  { key: 'item_code', label: 'Item', align: 'left' },
  { key: 'current_stock', label: 'In stock', align: 'right' },
  { key: 'minimum_stock', label: 'Minimum', align: 'right' },
  { key: 'recommended_quantity', label: 'Order qty', align: 'right' },
  { key: 'unit_price', label: 'Unit price', align: 'right', className: 'hidden lg:table-cell' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'status', label: 'Status', align: 'center' },
];

const lineTotal = (r) => (Number(r.unit_price) || 0) * (Number(r.recommended_quantity) || 0);

function sortValue(r, key) {
  if (key === 'total') return lineTotal(r);
  if (key === 'status') return STATUS_ORDER[r.status] ?? 9;
  if (key === 'item_code') return (r.item_code || '').toLowerCase();
  return Number(r[key]) || 0;
}

const TILE_TONES = {
  warning: 'bg-warning/10 text-warning',
  critical: 'bg-critical/10 text-critical',
  info: 'bg-info/10 text-info',
  primary: 'bg-primary/10 text-primary',
};

function SummaryTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TILE_TONES[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-base sm:text-lg font-bold tabular-nums leading-tight break-words">{value}</p>
      </div>
    </div>
  );
}

function StatusPill({ r }) {
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        r.status === 'critical' ? 'bg-critical/10 text-critical' : 'bg-warning/10 text-warning'
      }`}>
        {r.status === 'critical' ? 'Critical' : 'Low'}
      </span>
      {isMissingFromReport(r) && <span className="text-[10px] text-info whitespace-nowrap">Not in report</span>}
    </span>
  );
}

function MiniStat({ label, value, danger = false, highlight = false }) {
  return (
    <div className={`rounded-lg py-1.5 ${highlight ? 'bg-primary/10' : 'bg-muted/60'}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-base font-bold tabular-nums ${danger ? 'text-critical' : highlight ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}

function WarehouseBreakdown({ breakdown }) {
  const entries = Object.entries(breakdown || {});
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">Not found in the report — counted as zero stock.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([name, info]) => (
        <span
          key={name}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs ${
            info?.enabled ? 'bg-card' : 'bg-muted text-muted-foreground line-through decoration-muted-foreground/40'
          }`}
          title={info?.enabled ? 'Counted in stock' : 'Warehouse disabled — not counted'}
        >
          {name}{info?.name && <span className="text-muted-foreground">· {info.name}</span>}
          <span className="font-semibold tabular-nums no-underline">{info?.quantity ?? 0}</span>
        </span>
      ))}
    </div>
  );
}

export default function ResultsTable({ results, vendorId, vendorName, currency, manualItems = [] }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'status', dir: 'asc' });
  const [expanded, setExpanded] = useState(null);
  const symbol = getCurrencySymbol(currency);

  const purchaseItems = useMemo(
    () => results.filter(r => r.status === 'critical' || r.status === 'low'),
    [results]
  );
  const unknownItems = useMemo(() => results.filter(r => r.status === 'unknown'), [results]);

  const counts = {
    all: purchaseItems.length,
    critical: purchaseItems.filter(r => r.status === 'critical').length,
    low: purchaseItems.filter(r => r.status === 'low').length,
    missing: purchaseItems.filter(isMissingFromReport).length,
  };

  const normalizedManual = manualItems.map(m => ({
    item_code: m.item_code || '',
    description: m.description || '',
    current_stock: '-',
    minimum_stock: 0,
    recommended_quantity: Number(m.quantity) || 0,
    unit_price: Number(m.unit_price) || 0,
    status: 'manual',
  }));
  const allPurchaseItems = [...purchaseItems, ...normalizedManual];
  const grandTotal = allPurchaseItems.reduce((sum, r) => sum + lineTotal(r), 0);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = purchaseItems.filter(r => {
      if (filter === 'missing' && !isMissingFromReport(r)) return false;
      if ((filter === 'critical' || filter === 'low') && r.status !== filter) return false;
      if (!q) return true;
      return (r.item_code || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return (Number(b.recommended_quantity) || 0) - (Number(a.recommended_quantity) || 0);
    });
  }, [purchaseItems, filter, query, sort]);

  const toggleSort = (key) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'item_code' || key === 'status' ? 'asc' : 'desc' });
  };

  // Export libraries are large, so load them only when exporting.
  const handleExport = async (type) => {
    const { exportPurchaseExcel, exportPurchasePDF } = await import('@/lib/exportUtils');
    if (type === 'excel') exportPurchaseExcel(allPurchaseItems, vendorName, currency);
    else exportPurchasePDF(allPurchaseItems, vendorName, currency);
  };

  const formatMoney = (val) => {
    const n = Number(val) || 0;
    return n > 0 ? `${symbol} ${n.toLocaleString()}` : '-';
  };

  if (purchaseItems.length === 0 && unknownItems.length === 0) {
    return (
      <Card className="p-12 text-center shadow-sm">
        <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
        <p className="text-sm font-medium">All stock levels are sufficient</p>
        <p className="text-xs text-muted-foreground mt-1">No items require purchase at this time.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile icon={ShoppingCart} label="To purchase" value={counts.all} tone="warning" />
        <SummaryTile icon={AlertTriangle} label="Critical (zero stock)" value={counts.critical} tone="critical" />
        <SummaryTile icon={EyeOff} label="Not in report" value={counts.missing} tone="info" />
        <SummaryTile icon={Wallet} label="Estimated cost" value={grandTotal > 0 ? `${symbol} ${grandTotal.toLocaleString()}` : '-'} tone="primary" />
      </div>

      {purchaseItems.length > 0 && (
        <Card className="shadow-sm">
          {/* Toolbar stays visible while the page scrolls (desktop). */}
          <div className="p-3 sm:p-4 border-b flex flex-col lg:flex-row lg:items-center gap-3 bg-card rounded-t-xl lg:sticky lg:top-0 lg:z-20 lg:h-[64px]">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'
                  }`}
                >
                  {f.label} <span className="opacity-70">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 lg:ml-auto">
              <div className="relative flex-1 lg:w-72">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code or description" className="h-9 pl-8 text-sm" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9">
                    <Download className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Export</span>
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-success" /> Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2 text-critical" /> PDF (.pdf)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {visibleItems.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No items match this filter.</p>
          )}

          {/* Mobile: one card per item */}
          <div className="md:hidden divide-y">
            {visibleItems.map((r, i) => {
              const key = r.id || `${r.item_code}-${i}`;
              const isOpen = expanded === key;
              return (
                <div key={key} className={`p-4 border-l-[3px] ${r.status === 'critical' ? 'border-l-critical' : 'border-l-warning'}`}>
                  <button className="w-full text-left" onClick={() => setExpanded(isOpen ? null : key)}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-bold">{r.item_code}</p>
                        {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                      </div>
                      <StatusPill r={r} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <MiniStat label="In stock" value={r.current_stock} danger={Number(r.current_stock) <= 0} />
                      <MiniStat label="Minimum" value={r.minimum_stock} />
                      <MiniStat label="Order" value={r.recommended_quantity} highlight />
                    </div>
                    {lineTotal(r) > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground text-right">
                        <bdi>{formatMoney(r.unit_price)}</bdi> each · <bdi className="font-semibold text-foreground">{formatMoney(lineTotal(r))}</bdi>
                      </p>
                    )}
                  </button>
                  {isOpen && <div className="mt-3"><WarehouseBreakdown breakdown={r.warehouse_breakdown} /></div>}
                </div>
              );
            })}
          </div>

          {/* Desktop table — scrolls with the page, header stays pinned under the toolbar */}
          {visibleItems.length > 0 && (
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground lg:sticky lg:top-[64px] lg:z-10">
                <tr>
                  <th className="w-10 pl-4 py-3 text-left font-medium">#</th>
                  {COLUMNS.map(col => {
                    const active = sort.key === col.key;
                    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                    return (
                      <th key={col.key} className={`px-4 py-3 font-medium ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                        <button
                          onClick={() => toggleSort(col.key)}
                          className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground' : ''}`}
                        >
                          {col.label}<Icon className="w-3 h-3" />
                        </button>
                      </th>
                    );
                  })}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((r, i) => {
                  const key = r.id || `${r.item_code}-${i}`;
                  const isOpen = expanded === key;
                  const current = Number(r.current_stock) || 0;
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : key)}
                        className={`cursor-pointer border-t transition-colors border-l-[3px] ${
                          r.status === 'critical' ? 'border-l-critical' : 'border-l-warning'
                        } ${isOpen ? 'bg-accent/5' : i % 2 ? 'bg-muted/25 hover:bg-muted/50' : 'hover:bg-muted/50'}`}
                      >
                        <td className="pl-4 py-3.5 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-[13px] font-bold">{r.item_code}</p>
                          {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`text-base font-bold tabular-nums ${current <= 0 ? 'text-critical' : ''}`}>{current}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">{r.minimum_stock}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="inline-block min-w-[2.75rem] text-center px-2 py-1 rounded-md bg-primary/10 text-primary text-base font-bold tabular-nums">
                            {r.recommended_quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums hidden lg:table-cell">{formatMoney(r.unit_price)}</td>
                        <td className="px-4 py-3.5 text-right font-semibold tabular-nums">{formatMoney(lineTotal(r))}</td>
                        <td className="px-4 py-3.5 text-center"><StatusPill r={r} /></td>
                        <td className="pr-4 text-muted-foreground">
                          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-accent/5 border-l-[3px] border-l-transparent">
                          <td />
                          <td colSpan={COLUMNS.length + 1} className="px-4 pb-4 pt-0">
                            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Stock by warehouse</p>
                            <WarehouseBreakdown breakdown={r.warehouse_breakdown} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="px-4 py-3 border-t bg-muted/30 rounded-b-xl flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Showing {visibleItems.length} of {purchaseItems.length} items{normalizedManual.length > 0 && ` · ${normalizedManual.length} manual items included in export`}</span>
            {grandTotal > 0 && <span className="text-sm font-semibold text-foreground">Total: {symbol} {grandTotal.toLocaleString()}</span>}
          </div>
        </Card>
      )}

      {unknownItems.length > 0 && (
        <Card className="overflow-hidden border-info/30 shadow-sm">
          <div className="p-4 border-b bg-info/5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <PackageX className="w-5 h-5 text-info" />
              <h3 className="font-semibold">Unknown Items</h3>
              <span className="text-sm text-info">({unknownItems.length})</span>
              <span className="text-xs text-muted-foreground">— in the report but not in the master file</span>
            </div>
            {vendorId && (
              <Button asChild size="sm" variant="outline" className="sm:ml-auto">
                <Link to={`/part-list?vendor=${vendorId}`}>Classify in Part List<ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
            )}
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {unknownItems.map((r, i) => (
              <span key={r.id || i} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border bg-card text-xs">
                <span className="font-mono font-semibold">{r.item_code}</span>
                <span className="text-muted-foreground tabular-nums">{r.current_stock}</span>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
