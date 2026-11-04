import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Download, PackageX, CheckCircle2, FileSpreadsheet, FileText, ChevronDown, Search, ArrowRight,
  ArrowUpDown, ArrowUp, ArrowDown, ShoppingCart, AlertTriangle, EyeOff, Wallet, PenLine,
  Trash2, Loader2, X, Pencil, Check,
} from 'lucide-react';
import { getCurrencySymbol, formatPrice, formatSar, showsSar } from '@/lib/partConstants';
import Money from '@/components/Money';
import { isMissingFromReport, codeIncludes, catalogCodeKey, splitItemCode } from '@/lib/analysisUtils';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'low', label: 'Low' },
  { key: 'missing', label: 'Not in report' },
  { key: 'manual', label: 'Added manually' },
];

const STATUS_ORDER = { critical: 0, low: 1, manual: 2 };

const COLUMNS = [
  { key: 'item_code', label: 'Item No.', align: 'left' },
  { key: 'description', label: 'Item', align: 'left' },
  { key: 'source', label: 'Source', align: 'left' },
  { key: 'current_stock', label: 'In stock', align: 'right', title: 'Sorts by stock as a % of the minimum' },
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
  if (key === 'source') return r.source === 'manual' ? 1 : 0;
  if (key === 'item_code') return (r.item_code || '').toLowerCase();
  if (key === 'description') return (r.description || '').toLowerCase();
  // In stock sorts by how full the stock is (% of minimum), so the closest to running out come first.
  if (key === 'current_stock') {
    if (!hasStock(r)) return -1;
    const current = Number(r.current_stock) || 0;
    const min = Number(r.minimum_stock) || 0;
    return min > 0 ? current / min : current > 0 ? Infinity : 0;
  }
  return Number(r[key]) || 0;
}

// A stock figure exists only when the part appeared in the report (an analysis row missing from it is counted as 0,
// a manual row has stock only when its code is in the analysis).
const hasStock = (r) => r.current_stock !== null && r.current_stock !== undefined && !isMissingFromReport(r);

// A manual order whose part is already at or above its minimum stock in the latest report.
const stockIsEnough = (r) => r.source === 'manual' && hasStock(r) && r.minimum_stock !== null
  && (Number(r.current_stock) || 0) >= (Number(r.minimum_stock) || 0);

// Part key -> analysis row, so a manual item shows the stock the report has for the same part.
function indexByPart(results) {
  const map = new Map();
  for (const r of results) {
    for (const code of [r.item_code, ...splitItemCode(r.item_code)]) {
      const key = catalogCodeKey(code);
      if (key && !map.has(key)) map.set(key, r);
    }
  }
  return map;
}

const TILE_TONES = {
  warning: 'bg-warning/10 text-warning',
  critical: 'bg-critical/10 text-critical',
  info: 'bg-info/10 text-info',
  primary: 'bg-primary/10 text-primary',
};

function SummaryTile({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TILE_TONES[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-base sm:text-lg font-bold tabular-nums leading-tight break-words">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground tabular-nums break-words">{sub}</p>}
      </div>
    </div>
  );
}

// How full the stock is compared to its minimum: red when empty, amber below minimum.
function StockLevel({ r, compact = false }) {
  if (!hasStock(r)) {
    const text = r.source === 'manual' && !r.in_analysis ? 'Not in analysis' : 'Not in report';
    return (
      <span className="text-xs text-info whitespace-nowrap" title={r.source === 'manual'
        ? 'This code is not in the latest report, so its stock is unknown'
        : 'This part is not in the latest report, so it is counted as zero stock'}>
        {compact ? `Stock: ${text}` : text}
      </span>
    );
  }
  const current = Number(r.current_stock) || 0;
  const min = Number(r.minimum_stock) || 0;
  const pct = min > 0 ? Math.max(0, Math.min(100, (current / min) * 100)) : 0;
  const empty = current <= 0;
  const bar = (
    <div className={`h-1.5 rounded-full overflow-hidden ${empty ? 'bg-critical/15' : 'bg-muted'} ${compact ? 'flex-1' : 'w-24'}`}>
      <div className={`h-full rounded-full ${empty ? 'bg-critical' : 'bg-warning'}`} style={{ width: `${empty ? 0 : Math.max(pct, 4)}%` }} />
    </div>
  );
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {bar}
        <span className={`text-[11px] tabular-nums whitespace-nowrap ${empty ? 'text-critical' : 'text-muted-foreground'}`}>
          {empty ? 'Out of stock' : `${Math.round(pct)}% of minimum`}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1" title={`${current} of ${min} minimum (${Math.round(pct)}%)`}>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-base font-bold tabular-nums ${empty ? 'text-critical' : ''}`}>{current}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{Math.round(pct)}%</span>
      </div>
      {bar}
    </div>
  );
}

const STATUS_STYLE = {
  critical: ['Critical', 'bg-critical/10 text-critical'],
  low: ['Low', 'bg-warning/10 text-warning'],
  manual: ['Manual', 'bg-primary/10 text-primary'],
};

function StatusPill({ r }) {
  const [label, cls] = STATUS_STYLE[r.status] || STATUS_STYLE.low;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
  );
}

// Where the row comes from: the report analysis or the manual order list (with a warning when a part is in both).
function SourceTag({ r }) {
  const manual = r.source === 'manual';
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap ${
        manual ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-muted/60 border-border text-muted-foreground'
      }`}>
        {manual ? <PenLine className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
        {manual ? 'Manual' : 'Analysis'}
      </span>
      {stockIsEnough(r) && (
        <span className="text-[10px] text-success whitespace-nowrap" title="The latest report already has this part at or above its minimum">
          Stock is enough
        </span>
      )}
      {r.duplicate && (
        <span className="text-[10px] text-warning whitespace-nowrap" title="The same part is also ordered in another row — check the order quantity">
          {manual ? 'Also in analysis' : 'Also added manually'}
        </span>
      )}
    </span>
  );
}

// A number edited in place (minimum, order quantity): click it, type, Enter (or leaving the field) saves, Escape cancels.
function NumberEditor({ value, onSave, title, label, buttonClassName, size = 'md' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const savingRef = useRef(false);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const start = (e) => {
    e.stopPropagation();
    setDraft(value === null || value === undefined ? '' : String(value));
    setEditing(true);
  };
  const save = async () => {
    if (savingRef.current) return; // Enter disables the field, which can fire blur → save a second time
    const next = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(next) || next < 0 || next === Number(value)) {
      setEditing(false);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const ok = await onSave(Math.round(next));
    savingRef.current = false;
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={save}
          className={`${size === 'sm' ? 'h-8 w-20' : 'h-8 w-16'} px-2 text-right tabular-nums`}
          aria-label={label}
        />
        {saving
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          : <button onMouseDown={(e) => e.preventDefault()} onClick={save} className="p-1 rounded hover:bg-primary/10 text-primary" aria-label={`Save ${label.toLowerCase()}`}><Check className="w-3.5 h-3.5" /></button>}
      </span>
    );
  }
  return (
    <button
      onClick={start}
      className={buttonClassName || 'group inline-flex items-center gap-1 px-1.5 py-0.5 -mr-1.5 rounded hover:bg-muted tabular-nums'}
      title={title}
      aria-label={`Edit ${label.toLowerCase()}`}
    >
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
      {value ?? '—'}
    </button>
  );
}

const MIN_TITLE = 'Edit the minimum (saved to the master list)';
const QTY_BUTTON = 'group inline-flex items-center justify-center gap-1 min-w-[2.75rem] px-2 py-1 rounded-md bg-primary/10 text-primary text-base font-bold tabular-nums hover:bg-primary/20 hover:ring-1 hover:ring-primary/30';

// Order quantity the analysis suggests for a row (stock up to the minimum); null for manual rows.
function suggestedQuantity(r) {
  if (r.source !== 'analysis') return null;
  const current = Number(r.current_stock) || 0;
  const min = Number(r.minimum_stock) || 0;
  return Math.max(min - current, 0);
}

function QuantityCell({ r, onSave }) {
  const suggested = suggestedQuantity(r);
  const changed = suggested !== null && suggested !== Number(r.recommended_quantity);
  const editor = onSave
    ? (
      <NumberEditor
        value={r.recommended_quantity}
        onSave={onSave}
        label="Order quantity"
        title={r.source === 'manual' ? 'Edit the quantity (saved to the manual order)' : 'Edit the order quantity for this analysis'}
        buttonClassName={QTY_BUTTON}
      />
    )
    : (
      <span className="inline-block min-w-[2.75rem] text-center px-2 py-1 rounded-md bg-primary/10 text-primary text-base font-bold tabular-nums">
        {r.recommended_quantity}
      </span>
    );
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      {editor}
      {changed && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap" title="Quantity changed by hand — the analysis suggests a different one">
          Suggested {suggested}
        </span>
      )}
    </span>
  );
}

const ROW_BORDER = { critical: 'border-l-critical', low: 'border-l-warning', manual: 'border-l-primary' };

function MiniStat({ label, value, danger = false, highlight = false }) {
  return (
    <div className={`rounded-lg py-1.5 ${highlight ? 'bg-primary/10' : 'bg-muted/60'}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-base font-bold tabular-nums ${danger ? 'text-critical' : highlight ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}

function WarehouseBreakdown({ r }) {
  const entries = Object.entries(r.warehouse_breakdown || {});
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {r.source === 'manual' && !hasStock(r)
          ? 'Added manually — this code is not in the latest report, so its stock is unknown.'
          : 'Not found in the report — counted as zero stock.'}
      </p>
    );
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

export default function ResultsTable({ results, vendorId, vendorName, currency, sarRate, manualItems = [], onDeleteManual, onUpdateMinimum, onUpdateQuantity }) {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(() => new Set()); // manual item ids
  const [confirmIds, setConfirmIds] = useState(null); // manual item ids waiting for confirmation
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'status', dir: 'asc' });
  const [expanded, setExpanded] = useState(null);
  const symbol = getCurrencySymbol(currency);

  const unknownItems = useMemo(() => results.filter(r => r.status === 'unknown'), [results]);

  // Analysis rows and manual rows in one list. A manual row takes its stock, minimum and warehouses
  // from the analysis row of the same part, so its current stock is visible too.
  const { purchaseItems, manualRows, allPurchaseItems } = useMemo(() => {
    const byPart = indexByPart(results);
    const manualKeys = new Set(manualItems.map(m => catalogCodeKey(m.item_code)).filter(Boolean));
    const analysisRows = results
      .filter(r => r.status === 'critical' || r.status === 'low')
      .map(r => ({ ...r, source: 'analysis', duplicate: manualKeys.has(catalogCodeKey(r.item_code)) }));
    const analysisKeys = new Set(analysisRows.map(r => catalogCodeKey(r.item_code)));
    const manual = manualItems.map(m => {
      const key = catalogCodeKey(m.item_code);
      const found = key ? byPart.get(key) : null;
      // A part the analysis only assumed as zero (absent from the report) has no stock reading either.
      const match = found && !isMissingFromReport(found) ? found : null;
      const known = match && match.status !== 'unknown' ? match : null;
      return {
        id: `manual-${m.id}`,
        manual_id: m.id,
        analysis_id: known?.id || null,
        source: 'manual',
        item_code: m.item_code || '',
        description: m.description || known?.description || '',
        current_stock: match ? match.current_stock : null,
        minimum_stock: known ? known.minimum_stock : found?.minimum_stock ?? null,
        warehouse_breakdown: match?.warehouse_breakdown || {},
        recommended_quantity: Number(m.quantity) || 0,
        unit_price: Number(m.unit_price) || 0,
        status: 'manual',
        notes: m.notes || '',
        in_analysis: !!found,
        duplicate: analysisKeys.has(key),
      };
    });
    return { purchaseItems: analysisRows, manualRows: manual, allPurchaseItems: [...analysisRows, ...manual] };
  }, [results, manualItems]);

  const counts = {
    all: allPurchaseItems.length,
    critical: purchaseItems.filter(r => r.status === 'critical').length,
    low: purchaseItems.filter(r => r.status === 'low').length,
    missing: purchaseItems.filter(isMissingFromReport).length,
    manual: manualRows.length,
  };
  const duplicateCount = manualRows.filter(r => r.duplicate).length;
  const enoughIds = manualRows.filter(stockIsEnough).map(r => r.manual_id);
  // Ids of deleted items drop out of the selection on their own.
  const selectedIds = manualRows.filter(r => selected.has(r.manual_id)).map(r => r.manual_id);
  const canDelete = !!onDeleteManual;
  const saveQuantity = (r) => (onUpdateQuantity && (r.source === 'manual' || r.id) ? (v) => onUpdateQuantity(r, v) : null);
  // The analysis row whose minimum a table row edits (a manual row edits the analysis row of its part).
  const minimumTarget = (r) => {
    if (!onUpdateMinimum) return null;
    if (r.source === 'analysis') return r.id || null;
    return r.analysis_id;
  };

  const toggleSelected = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await onDeleteManual(confirmIds);
      setSelected(prev => new Set([...prev].filter(id => !confirmIds.includes(id))));
    } finally {
      setDeleting(false);
      setConfirmIds(null);
    }
  };
  const confirmRows = manualRows.filter(r => confirmIds?.includes(r.manual_id));

  const grandTotal = allPurchaseItems.reduce((sum, r) => sum + lineTotal(r), 0);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = allPurchaseItems.filter(r => {
      if (filter === 'missing' && (r.source !== 'analysis' || !isMissingFromReport(r))) return false;
      if (filter === 'manual' && r.source !== 'manual') return false;
      if ((filter === 'critical' || filter === 'low') && r.status !== filter) return false;
      if (!q) return true;
      return codeIncludes(r.item_code, q) || (r.description || '').toLowerCase().includes(q);
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return (Number(b.recommended_quantity) || 0) - (Number(a.recommended_quantity) || 0);
    });
  }, [allPurchaseItems, filter, query, sort]);

  const toggleSort = (key) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: ['item_code', 'description', 'status', 'source', 'current_stock'].includes(key) ? 'asc' : 'desc' });
  };

  // Export libraries are large, so load them only when exporting.
  const handleExport = async (type) => {
    const { exportPurchaseExcel, exportPurchasePDF } = await import('@/lib/exportUtils');
    const rows = allPurchaseItems.map(r => ({
      ...r,
      current_stock: hasStock(r) ? r.current_stock : r.source === 'manual' ? '-' : 0,
      minimum_stock: r.minimum_stock ?? '-',
    }));
    if (type === 'excel') exportPurchaseExcel(rows, vendorName, currency, sarRate);
    else exportPurchasePDF(rows, vendorName, currency, sarRate);
  };

  const withSar = showsSar(currency, sarRate);
  const totalText = `${symbol} ${formatPrice(grandTotal)}`;

  if (allPurchaseItems.length === 0 && unknownItems.length === 0) {
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
        <SummaryTile
          icon={ShoppingCart}
          label="To purchase"
          value={counts.all}
          sub={counts.manual > 0 ? `${purchaseItems.length} from analysis · ${counts.manual} manual` : null}
          tone="warning"
        />
        <SummaryTile icon={AlertTriangle} label="Critical (zero stock)" value={counts.critical} tone="critical" />
        <SummaryTile icon={EyeOff} label="Not in report" value={counts.missing} tone="info" />
        <SummaryTile
          icon={Wallet}
          label="Estimated cost"
          value={grandTotal <= 0 ? '-' : <bdi>{withSar ? formatSar(grandTotal, sarRate) : totalText}</bdi>}
          sub={grandTotal > 0 && withSar ? <bdi>{totalText}</bdi> : null}
          tone="primary"
        />
      </div>

      {allPurchaseItems.length > 0 && (
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

          {canDelete && counts.manual > 0 && (selectedIds.length > 0 || filter === 'manual') && (
            <div className="px-3 sm:px-4 py-2 border-b bg-primary/5 flex flex-wrap items-center gap-2 text-xs">
              {selectedIds.length > 0 ? (
                <>
                  <span className="font-medium">{selectedIds.length} manual {selectedIds.length === 1 ? 'item' : 'items'} selected</span>
                  <Button size="sm" variant="destructive" className="h-7" onClick={() => setConfirmIds(selectedIds)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelected(new Set())}>
                    <X className="w-3.5 h-3.5 mr-1" />Clear
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground">Tick the manual items you no longer need, then delete them.</span>
              )}
              {enoughIds.length > 0 && (
                <Button size="sm" variant="outline" className="h-7 sm:ml-auto" onClick={() => setSelected(new Set(enoughIds))}>
                  Select items with enough stock ({enoughIds.length})
                </Button>
              )}
            </div>
          )}

          {visibleItems.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No items match this filter.</p>
          )}

          {/* Mobile: one card per item */}
          <div className="md:hidden divide-y">
            {visibleItems.map((r, i) => {
              const key = r.id || `${r.item_code}-${i}`;
              const isOpen = expanded === key;
              return (
                <div key={key} className={`p-4 border-l-[3px] ${ROW_BORDER[r.status] || 'border-l-warning'}`}>
                  <div className="flex items-start gap-3">
                  {canDelete && r.source === 'manual' && (
                    <span className="pt-0.5">
                      <Checkbox checked={selected.has(r.manual_id)} onCheckedChange={() => toggleSelected(r.manual_id)} aria-label={`Select ${r.item_code}`} />
                    </span>
                  )}
                  <button className="min-w-0 flex-1 text-left" onClick={() => setExpanded(isOpen ? null : key)}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-bold">{r.item_code}</p>
                        {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                        <div className="mt-1.5"><SourceTag r={r} /></div>
                      </div>
                      <StatusPill r={r} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <MiniStat label="In stock" value={hasStock(r) ? r.current_stock : '—'} danger={hasStock(r) && Number(r.current_stock) <= 0} />
                      <MiniStat label="Minimum" value={r.minimum_stock ?? '—'} />
                      <MiniStat label="Order" value={r.recommended_quantity} highlight />
                    </div>
                    <div className="mt-2.5">
                      <StockLevel compact r={r} />
                    </div>
                    {lineTotal(r) > 0 && (
                      <div className="mt-2 flex items-start justify-end gap-1.5 text-xs text-muted-foreground">
                        <Money value={r.unit_price} currency={currency} sarRate={sarRate} /> <span>each ·</span>
                        <Money value={lineTotal(r)} currency={currency} sarRate={sarRate} className="font-semibold text-foreground" />
                      </div>
                    )}
                  </button>
                  </div>
                  {isOpen && (
                    <div className="mt-3 space-y-3">
                      {minimumTarget(r) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          Minimum
                          <NumberEditor size="sm" label="Minimum" title={MIN_TITLE} value={r.minimum_stock} onSave={(v) => onUpdateMinimum(minimumTarget(r), v)} />
                        </div>
                      )}
                      {saveQuantity(r) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          Order qty
                          <QuantityCell r={r} onSave={saveQuantity(r)} />
                        </div>
                      )}
                      <WarehouseBreakdown r={r} />
                      {canDelete && r.source === 'manual' && (
                        <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => setConfirmIds([r.manual_id])}>
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete manual item
                        </Button>
                      )}
                    </div>
                  )}
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
                          title={col.title}
                          className={`inline-flex items-center gap-1 hover:text-foreground ${active ? 'text-foreground' : ''}`}
                        >
                          {col.label}<Icon className="w-3 h-3" />
                        </button>
                      </th>
                    );
                  })}
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((r, i) => {
                  const key = r.id || `${r.item_code}-${i}`;
                  const isOpen = expanded === key;
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : key)}
                        className={`cursor-pointer border-t transition-colors border-l-[3px] ${
                          ROW_BORDER[r.status] || 'border-l-warning'
                        } ${isOpen ? 'bg-accent/5' : i % 2 ? 'bg-muted/25 hover:bg-muted/50' : 'hover:bg-muted/50'}`}
                      >
                        <td className="pl-4 py-3.5 text-xs text-muted-foreground tabular-nums">
                          {canDelete && r.source === 'manual' ? (
                            <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                              <Checkbox checked={selected.has(r.manual_id)} onCheckedChange={() => toggleSelected(r.manual_id)} aria-label={`Select ${r.item_code}`} />
                            </span>
                          ) : i + 1}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[13px] font-bold whitespace-nowrap">{r.item_code}</td>
                        <td className="px-4 py-3.5">{r.description || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-4 py-3.5"><SourceTag r={r} /></td>
                        <td className="px-4 py-3.5 text-right">
                          <StockLevel r={r} />
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                          {minimumTarget(r)
                            ? <NumberEditor label="Minimum" title={MIN_TITLE} value={r.minimum_stock} onSave={(v) => onUpdateMinimum(minimumTarget(r), v)} />
                            : (r.minimum_stock ?? '—')}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <QuantityCell r={r} onSave={saveQuantity(r)} />
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums hidden lg:table-cell"><Money value={r.unit_price} currency={currency} sarRate={sarRate} /></td>
                        <td className="px-4 py-3.5 text-right font-semibold tabular-nums"><Money value={lineTotal(r)} currency={currency} sarRate={sarRate} /></td>
                        <td className="px-4 py-3.5 text-center"><StatusPill r={r} /></td>
                        <td className="pr-4 text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {canDelete && r.source === 'manual' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmIds([r.manual_id]); }}
                                className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
                                title="Delete this manual item"
                                aria-label={`Delete ${r.item_code}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-accent/5 border-l-[3px] border-l-transparent">
                          <td />
                          <td colSpan={COLUMNS.length + 1} className="px-4 pb-4 pt-0">
                            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Stock by warehouse</p>
                            <WarehouseBreakdown r={r} />
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
            <span>
              Showing {visibleItems.length} of {allPurchaseItems.length} items · {purchaseItems.length} from analysis · {manualRows.length} added manually
              {duplicateCount > 0 && <span className="text-warning"> · {duplicateCount} manual {duplicateCount === 1 ? 'item is' : 'items are'} also in the analysis</span>}
            </span>
            {grandTotal > 0 && (
              <span className="text-sm font-semibold text-foreground">
                Total: {withSar
                  ? <bdi className="cursor-help" title={`${totalText}  (1 ${currency} = ${sarRate} SAR)`}>{formatSar(grandTotal, sarRate)}</bdi>
                  : <bdi>{totalText}</bdi>}
              </span>
            )}
          </div>
        </Card>
      )}

      <AlertDialog open={!!confirmIds} onOpenChange={(open) => { if (!open && !deleting) setConfirmIds(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmRows.length} manual {confirmRows.length === 1 ? 'item' : 'items'}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>They are removed from the manual order list. Items from the analysis are not affected.</p>
                <ul className="max-h-48 overflow-y-auto rounded-md border divide-y text-xs">
                  {confirmRows.map(r => (
                    <li key={r.id} className="flex items-center gap-2 px-2.5 py-1.5">
                      <span className="font-mono font-semibold text-foreground">{r.item_code}</span>
                      <span className="truncate flex-1">{r.description}</span>
                      <span className="tabular-nums whitespace-nowrap">qty {r.recommended_quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
