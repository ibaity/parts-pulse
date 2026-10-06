import { useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/fetchAll';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Merge, Check, AlertTriangle } from 'lucide-react';
import { planMerge } from '@/lib/dedupe';
import { formatPrice } from '@/lib/partConstants';

const CONCURRENCY = 8;
const SHOW_GROUPS = 50;
const CONFIRM_ABOVE = 50;

// Runs `fn` over `items` with a limited number of requests in flight. Stops early if `shouldStop()` is true.
async function runPool(items, fn, shouldStop, onProgress) {
  let next = 0;
  let done = 0;
  const failures = [];
  const worker = async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next++];
      try {
        await fn(item);
      } catch {
        try { await fn(item); } catch { failures.push(item); } // one retry
      }
      onProgress(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return { done, failures };
}

// Lists duplicate master items and merges each group into its newest record.
export default function MergeDuplicatesDialog({ open, onOpenChange, groups, suspicious = [], currency, onMerged }) {
  const [merging, setMerging] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, stage: '' });
  const [confirmed, setConfirmed] = useState(false);
  const cancelRef = useRef(false);
  const { toast } = useToast();
  const plans = useMemo(() => groups.map(planMerge), [groups]);
  const removeCount = plans.reduce((n, p) => n + p.removeIds.length, 0);
  const needsConfirm = removeCount > CONFIRM_ABOVE;

  const handleMerge = async () => {
    cancelRef.current = false;
    setMerging(true);
    let result = { done: 0, failures: [] };
    try {
      // 1. Fill the kept records' empty fields from the older copies.
      setProgress({ done: 0, total: 0, stage: 'Updating kept records...' });
      const updates = plans.filter(p => Object.keys(p.changes).length).map(p => ({ id: p.keepId, ...p.changes }));
      for (let i = 0; i < updates.length && !cancelRef.current; i += 200) {
        await base44.entities.MasterItem.bulkUpdate(updates.slice(i, i + 200));
      }

      // 2. Point device-model links at the kept record (one request for all links).
      const keepFor = new Map(plans.flatMap(p => p.removeIds.map(id => [id, p.keepId])));
      if (!cancelRef.current) {
        setProgress({ done: 0, total: 0, stage: 'Checking device links...' });
        const links = (await fetchAll(base44.entities.DeviceModelItem, {}).catch(() => [])).filter(l => keepFor.has(l.master_item_id));
        await runPool(links, l => base44.entities.DeviceModelItem.update(l.id, { master_item_id: keepFor.get(l.master_item_id) }), () => cancelRef.current, () => {});
      }

      // 3. Remove the extra copies.
      const removeIds = [...keepFor.keys()];
      setProgress({ done: 0, total: removeIds.length, stage: 'Removing extra records' });
      result = await runPool(
        removeIds,
        id => base44.entities.MasterItem.delete(id),
        () => cancelRef.current,
        (done) => setProgress({ done, total: removeIds.length, stage: 'Removing extra records' })
      );

      const failed = result.failures.length;
      const stopped = cancelRef.current && result.done < removeIds.length;
      toast({
        title: failed || stopped ? 'Merge finished with issues' : 'Duplicates merged',
        description: `${result.done - failed} extra records removed${failed ? ` · ${failed} failed` : ''}${stopped ? ' · stopped early' : ''}`,
        variant: failed ? 'destructive' : undefined,
      });
    } catch {
      toast({ title: 'Error', description: 'Merging stopped. Reload the page to see the current state.', variant: 'destructive' });
    }
    setMerging(false);
    setConfirmed(false);
    onOpenChange(false);
    onMerged?.();
  };

  const close = (v) => {
    if (merging) return;
    setConfirmed(false);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Merge duplicate parts</DialogTitle>
          <DialogDescription>
            {plans.length} parts are recorded more than once (same Mediserv code). The newest record of each is kept, its empty
            fields are filled from the older copies, and the {removeCount} extra records are removed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {suspicious.length > 0 && (
            <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p>
                <span className="font-semibold">{suspicious.length} groups need manual review</span> and are not merged: they have more than
                5 records with the same code ({suspicious.map(g => g[0].mediserv_item_code || g[0].manufacturer_item_code).slice(0, 5).join(', ')}
                {suspicious.length > 5 ? ', …' : ''}).
              </p>
            </div>
          )}

          {plans.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No safe duplicates to merge.</p>}

          {groups.slice(0, SHOW_GROUPS).map((group, gi) => {
            const plan = plans[gi];
            return (
              <div key={plan.keepId} className="rounded-lg border">
                <div className="px-3 py-2 border-b bg-muted/40 text-sm font-semibold font-mono">
                  {plan.keep.mediserv_item_code || plan.keep.manufacturer_item_code}
                </div>
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">Mediserv / Mfr code</th>
                      <th className="text-left px-3 py-1.5 font-medium">Description</th>
                      <th className="text-right px-3 py-1.5 font-medium">Min</th>
                      <th className="text-right px-3 py-1.5 font-medium">Price</th>
                      <th className="px-3 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.map(item => {
                      const kept = item.id === plan.keepId;
                      const merged = kept ? { ...item, ...plan.changes } : item;
                      return (
                        <tr key={item.id} className={`border-t ${kept ? 'bg-success/5' : 'text-muted-foreground line-through decoration-muted-foreground/40'}`}>
                          <td className="px-3 py-1.5 font-mono">{merged.mediserv_item_code || '—'} / {merged.manufacturer_item_code || '—'}</td>
                          <td className="px-3 py-1.5">{merged.description || '—'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{merged.minimum_stock ?? 0}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{currency} {formatPrice(merged.unit_price)}</td>
                          <td className="px-3 py-1.5 text-right whitespace-nowrap">
                            {kept
                              ? <span className="inline-flex items-center gap-1 text-success font-semibold no-underline"><Check className="w-3.5 h-3.5" />Keep</span>
                              : <span className="no-underline">Remove</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
          {groups.length > SHOW_GROUPS && (
            <p className="text-center text-xs text-muted-foreground">+ {groups.length - SHOW_GROUPS} more groups (all will be merged)</p>
          )}
        </div>

        {needsConfirm && !merging && (
          <label className="flex items-start gap-2 text-xs rounded-lg border border-warning/30 bg-warning/5 p-3 cursor-pointer">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
            <span>I reviewed the list. This will permanently delete <b>{removeCount}</b> records and can&apos;t be undone.</span>
          </label>
        )}

        {merging && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {progress.stage}{progress.total ? ` — ${progress.done} / ${progress.total}` : ''}
            </p>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '8%' }} />
            </div>
          </div>
        )}

        <DialogFooter>
          {merging ? (
            <Button variant="outline" onClick={() => { cancelRef.current = true; }}>Stop</Button>
          ) : (
            <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
          )}
          <Button onClick={handleMerge} disabled={merging || plans.length === 0 || (needsConfirm && !confirmed)}>
            {merging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Merge className="w-4 h-4 mr-2" />}
            Merge all ({plans.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
