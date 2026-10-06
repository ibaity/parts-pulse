import { useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileSpreadsheet, Loader2, ArrowRight, TrendingUp, TrendingDown, X, CheckCircle2 } from 'lucide-react';
import { readSheet } from '@/lib/reportParser';
import { PRICE_FIELDS, detectPriceColumns, buildPriceUpdatePlan } from '@/lib/priceImport';
import { formatPrice } from '@/lib/partConstants';

const NONE = '__none__';
const CHUNK = 200;
const SHOW = 40;

// Updates unit prices of existing parts from an Excel/CSV price list, matched by Mediserv code.
export default function PriceUpdateDialog({ open, onOpenChange, vendorId, masterItems, currency, onUpdated }) {
  const [file, setFile] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [mapping, setMapping] = useState({});
  const [fixMaker, setFixMaker] = useState(true);
  const [addNew, setAddNew] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const inputRef = useRef(null);
  const { toast } = useToast();

  const reset = () => {
    setFile(null); setSheet(null); setMapping({}); setFixMaker(true); setAddNew(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const pickFile = async (f) => {
    if (!f) return;
    try {
      const parsed = readSheet(await f.arrayBuffer());
      if (!parsed.rows.length) throw new Error('empty');
      setFile(f); setSheet(parsed); setMapping(detectPriceColumns(parsed.columns));
    } catch {
      toast({ title: 'Error', description: 'Could not read this file. Use an Excel or CSV file with a header row.', variant: 'destructive' });
      reset();
    }
  };

  const ready = sheet && mapping.code && mapping.price;
  const plan = useMemo(() => (ready ? buildPriceUpdatePlan(sheet.rows, mapping, masterItems) : null), [ready, sheet, mapping, masterItems]);
  const ups = plan ? plan.changes.filter(c => c.newPrice > c.oldPrice).length : 0;
  const downs = plan ? plan.changes.length - ups : 0;
  const bigMoves = plan ? plan.changes.filter(c => c.pct !== null && Math.abs(c.pct) > 50).length : 0;
  const canAddNew = plan && mapping.description && plan.notFound.length > 0;
  // Records that will be saved (a part whose price and part number both change counts once).
  const total = plan
    ? new Set([...plan.changes.map(c => c.item.id), ...(fixMaker ? plan.makerFixes.map(f => f.item.id) : [])]).size + (addNew && canAddNew ? plan.notFound.length : 0)
    : 0;
  const symbol = currency || '';

  const apply = async () => {
    setApplying(true);
    try {
      // One merged patch per record (price and manufacturer part number together).
      const patches = new Map();
      plan.changes.forEach(c => patches.set(c.item.id, { id: c.item.id, unit_price: c.newPrice }));
      if (fixMaker) plan.makerFixes.forEach(f => patches.set(f.item.id, { ...(patches.get(f.item.id) || { id: f.item.id }), manufacturer_item_code: f.to }));
      const updates = [...patches.values()];
      const creates = addNew && canAddNew
        ? plan.notFound.map(r => ({ vendor_id: vendorId, mediserv_item_code: r.code.toUpperCase(), manufacturer_item_code: r.makerPn, description: r.description, unit_price: r.price, minimum_stock: 0 }))
        : [];
      const steps = [
        ...Array.from({ length: Math.ceil(updates.length / CHUNK) }, (_, i) => () => base44.entities.MasterItem.bulkUpdate(updates.slice(i * CHUNK, (i + 1) * CHUNK))),
        ...Array.from({ length: Math.ceil(creates.length / CHUNK) }, (_, i) => () => base44.entities.MasterItem.bulkCreate(creates.slice(i * CHUNK, (i + 1) * CHUNK))),
      ];
      setProgress({ done: 0, total: steps.length });
      for (let i = 0; i < steps.length; i += 3) {
        await Promise.all(steps.slice(i, i + 3).map(s => s()));
        setProgress({ done: Math.min(i + 3, steps.length), total: steps.length });
      }
      toast({ title: 'Prices updated', description: `${plan.changes.length} prices${fixMaker && plan.makerFixes.length ? ` · ${plan.makerFixes.length} part numbers` : ''}${creates.length ? ` · ${creates.length} new parts` : ''}` });
      reset();
      onOpenChange(false);
      onUpdated?.();
    } catch {
      toast({ title: 'Error', description: 'The update stopped part-way. Reload Part List to see the current prices, then run it again — it only changes what still differs.', variant: 'destructive' });
    }
    setApplying(false);
  };

  const close = (v) => { if (applying) return; if (!v) reset(); onOpenChange(v); };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Update prices from a file</DialogTitle>
          <DialogDescription>
            Upload your price list (Excel or CSV). Parts are matched by <b>Mediserv code</b>; you see every change before anything is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {!file ? (
            <label className="flex flex-col items-center gap-3 p-10 rounded-xl border-2 border-dashed cursor-pointer hover:border-accent/60 hover:bg-muted/40 transition-colors">
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center"><Upload className="w-6 h-6 text-accent" /></div>
              <p className="text-sm font-semibold">Click to choose the price file</p>
              <p className="text-xs text-muted-foreground">Needs a Mediserv code column and a price column</p>
            </label>
          ) : (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/60">
                <FileSpreadsheet className="w-5 h-5 text-success shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{sheet.rows.length.toLocaleString()} rows</p>
                </div>
                <Button variant="ghost" size="icon" onClick={reset} disabled={applying} aria-label="Remove file"><X className="w-4 h-4" /></Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {PRICE_FIELDS.map(f => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-xs font-medium flex items-center gap-1">
                      {f.label}{f.required && <span className="text-critical">*</span>}
                      {mapping[f.key] && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                    </label>
                    <Select value={mapping[f.key] || NONE} onValueChange={(v) => setMapping(prev => ({ ...prev, [f.key]: v === NONE ? undefined : v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select column" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— None —</SelectItem>
                        {sheet.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {plan && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat label="Prices to change" value={plan.changes.length} sub={`${ups} up · ${downs} down`} tone="primary" />
                    <Stat label="Already up to date" value={plan.unchanged} tone="success" />
                    <Stat label="Not in your list" value={plan.notFound.length} sub="in file, not in Part List" tone="info" />
                    <Stat label="Not in the file" value={plan.missingInFile} sub="keep their old price" />
                  </div>

                  {(bigMoves > 0 || plan.duplicatesInFile > 0 || plan.invalid > 0) && (
                    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs space-y-1">
                      {bigMoves > 0 && <p><b>{bigMoves}</b> prices change by more than 50% — check them in the table below.</p>}
                      {plan.duplicatesInFile > 0 && <p><b>{plan.duplicatesInFile}</b> codes appear more than once in the file; the last row is used.</p>}
                      {plan.invalid > 0 && <p><b>{plan.invalid}</b> rows have no code or no valid price and are skipped.</p>}
                    </div>
                  )}

                  {plan.changes.length > 0 && (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted text-muted-foreground">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Part</th>
                            <th className="text-right px-3 py-2 font-medium">Old price</th>
                            <th className="px-1" />
                            <th className="text-right px-3 py-2 font-medium">New price</th>
                            <th className="text-right px-3 py-2 font-medium">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...plan.changes].sort((a, b) => Math.abs(b.pct ?? 1e9) - Math.abs(a.pct ?? 1e9)).slice(0, SHOW).map(c => (
                            <tr key={c.item.id} className="border-t">
                              <td className="px-3 py-1.5">
                                <span className="font-mono font-semibold">{c.item.mediserv_item_code}</span>
                                <span className="text-muted-foreground"> {c.item.description}</span>
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground"><bdi>{symbol} {formatPrice(c.oldPrice)}</bdi></td>
                              <td className="px-1 text-muted-foreground"><ArrowRight className="w-3 h-3" /></td>
                              <td className="px-3 py-1.5 text-right tabular-nums font-semibold"><bdi>{symbol} {formatPrice(c.newPrice)}</bdi></td>
                              <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${c.newPrice > c.oldPrice ? 'text-critical' : 'text-success'}`}>
                                {c.pct === null ? 'new' : <span className="inline-flex items-center gap-1">{c.newPrice > c.oldPrice ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(c.pct).toFixed(1)}%</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {plan.changes.length > SHOW && <p className="px-3 py-2 text-center text-xs text-muted-foreground border-t">Showing the {SHOW} biggest changes of {plan.changes.length} — all will be applied.</p>}
                    </div>
                  )}

                  <div className="space-y-2">
                    {plan.makerFixes.length > 0 && (
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <Checkbox checked={fixMaker} onCheckedChange={(v) => setFixMaker(v === true)} className="mt-0.5" />
                        <span>
                          Also set the <b>manufacturer part number</b> for <b>{plan.makerFixes.length}</b> parts
                          <span className="text-muted-foreground"> — replaces brand names like &quot;{plan.makerFixes.find(f => f.from)?.from || 'Werfen'}&quot; and fills empty ones</span>
                        </span>
                      </label>
                    )}
                    {plan.notFound.length > 0 && (
                      <label className={`flex items-start gap-2 text-sm ${canAddNew ? 'cursor-pointer' : 'opacity-60'}`}>
                        <Checkbox checked={addNew && canAddNew} disabled={!canAddNew} onCheckedChange={(v) => setAddNew(v === true)} className="mt-0.5" />
                        <span>
                          Add the <b>{plan.notFound.length}</b> parts that are in the file but not in Part List
                          <span className="text-muted-foreground">{canAddNew ? ' (minimum stock 0)' : ' — choose the Description column to enable'}</span>
                        </span>
                      </label>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {applying && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Saving… {progress.done} / {progress.total}</p>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '8%' }} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={applying}>Cancel</Button>
          <Button onClick={apply} disabled={applying || !plan || total === 0}>
            {applying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {plan && total === 0 ? 'Nothing to update' : `Apply ${total ? `(${total})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, sub, tone }) {
  const color = { primary: 'text-primary', success: 'text-success', info: 'text-info' }[tone] || 'text-foreground';
  return (
    <div className="rounded-xl border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
