import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Download, PackageX, CheckCircle2, FileSpreadsheet, FileText, ChevronDown, ChevronRight, Search, ArrowRight,
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
  { key: 'current_stock', label: 'Stock / Min', align: 'left' },
  { key: 'recommended_quantity', label: 'Order Qty', align: 'right' },
  { key: 'unit_price', label: 'Price', align: 'right', className: 'hidden md:table-cell' },
  { key: 'total', label: 'Total', align: 'right', className: 'hidden sm:table-cell' },
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

function StockBar({ current, min }) {
  const pct = min > 0 ? Math.max(0, Math.min(100, (current / min) * 100)) : 0;
  const color = current <= 0 ? 'bg-critical' : 'bg-warning';
  return (
    <div className="min-w-[110px]">
      <div className="flex items-baseline gap-1 text-xs tabular-nums">
        <span className={`font-semibold ${current <= 0 ? 'text-critical' : ''}`}>{current}</span>
        <span className="text-muted-foreground">/ {min}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
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
          {name}<span className="font-semibold tabular-nums no-underline">{info?.quantity ?? 0}</span>
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
        <Card className="overflow-hidden shadow-sm">
          <div className="p-3 sm:p-4 border-b flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'
                  }`}
                >
                  {f.label} <span className="opacity-70">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 lg:ml-auto">
              <div className="relative flex-1 lg:w-64">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code or description" className="h-8 pl-8 text-sm" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8">
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

          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="w-8" />
                  {COLUMNS.map(col => {
                    const active = sort.key === col.key;
                    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                    return (
                      <th key={col.key} className={`p-3 font-medium ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.className || ''}`}>
                        <button
                          onClick={() => toggleSort(col.key)}
                          className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground' : ''}`}
                        >
                          {col.label}<Icon className="w-3 h-3" />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleItems.length === 0 && (
                  <tr><td colSpan={COLUMNS.length + 1} className="p-8 text-center text-sm text-muted-foreground">No items match this filter.</td></tr>
                )}
                {visibleItems.map((r, i) => {
                  const key = r.id || `${r.item_code}-${i}`;
                  const isOpen = expanded === key;
                  const missing = isMissingFromReport(r);
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : key)}
                        className={`cursor-pointer hover:bg-muted/40 transition-colors border-l-[3px] ${
                          r.status === 'critical' ? 'border-l-critical' : 'border-l-warning'
                        } ${isOpen ? 'bg-muted/30' : ''}`}
                      >
                        <td className="pl-2 text-muted-foreground">
                          <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </td>
                        <td className="p-3 max-w-[280px]">
                          <p className="font-mono text-xs font-semibold">{r.item_code}</p>
                          {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
                        </td>
                        <td className="p-3"><StockBar current={Number(r.current_stock) || 0} min={Number(r.minimum_stock) || 0} /></td>
                        <td className="p-3 text-right">
                          <span className="inline-block min-w-[2.5rem] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold tabular-nums">
                            {r.recommended_quantity}
                          </span>
                        </td>
                        <td className="p-3 text-right text-xs tabular-nums hidden md:table-cell">{formatMoney(r.unit_price)}</td>
                        <td className="p-3 text-right text-xs font-semibold tabular-nums hidden sm:table-cell">{formatMoney(lineTotal(r))}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            r.status === 'critical' ? 'bg-critical/10 text-critical' : 'bg-warning/10 text-warning'
                          }`}>
                            {r.status === 'critical' ? 'Critical' : 'Low'}
                          </span>
                          {missing && <span className="block mt-1 text-[10px] text-info whitespace-nowrap">Not in report</span>}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/20">
                          <td />
                          <td colSpan={COLUMNS.length} className="px-3 pb-3 pt-1">
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
          </div>
          <div className="px-4 py-2.5 border-t bg-muted/30 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Showing {visibleItems.length} of {purchaseItems.length} items{normalizedManual.length > 0 && ` · ${normalizedManual.length} manual items included in export`}</span>
            {grandTotal > 0 && <span className="font-semibold text-foreground">Total: {symbol} {grandTotal.toLocaleString()}</span>}
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
          <div className="p-4 flex flex-wrap gap-2 max-h-64 overflow-auto">
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
