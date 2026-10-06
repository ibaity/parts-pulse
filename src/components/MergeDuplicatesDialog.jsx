import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Merge, Check } from 'lucide-react';
import { planMerge } from '@/lib/dedupe';
import { formatPrice } from '@/lib/partConstants';

const DELETE_CHUNK = 20;

async function inChunks(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

// Lists duplicate master items and merges each group into its newest record.
export default function MergeDuplicatesDialog({ open, onOpenChange, groups, currency, onMerged }) {
  const [merging, setMerging] = useState(false);
  const { toast } = useToast();
  const plans = useMemo(() => groups.map(planMerge), [groups]);
  const removeCount = plans.reduce((n, p) => n + p.removeIds.length, 0);

  const handleMerge = async () => {
    setMerging(true);
    try {
      // 1. Fill the kept records' empty fields from the older copies.
      const updates = plans.filter(p => Object.keys(p.changes).length).map(p => ({ id: p.keepId, ...p.changes }));
      if (updates.length) await base44.entities.MasterItem.bulkUpdate(updates);

      // 2. Point any device-model links at the kept record.
      const keepFor = new Map(plans.flatMap(p => p.removeIds.map(id => [id, p.keepId])));
      await inChunks([...keepFor.keys()], DELETE_CHUNK, async (removedId) => {
        const links = await base44.entities.DeviceModelItem.filter({ master_item_id: removedId }).catch(() => []);
        await Promise.all(links.map(l => base44.entities.DeviceModelItem.update(l.id, { master_item_id: keepFor.get(removedId) })));
      });

      // 3. Remove the extra copies.
      await inChunks([...keepFor.keys()], DELETE_CHUNK, id => base44.entities.MasterItem.delete(id));

      toast({ title: 'Duplicates merged', description: `${plans.length} parts merged · ${removeCount} extra records removed` });
      onOpenChange(false);
      onMerged?.();
    } catch {
      toast({ title: 'Error', description: 'Merging failed part-way. Reload the page and try again.', variant: 'destructive' });
    }
    setMerging(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !merging && onOpenChange(v)}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Merge duplicate parts</DialogTitle>
          <DialogDescription>
            {plans.length} parts are recorded more than once. The newest record of each part is kept and its empty fields are
            filled from the older copies; the {removeCount} extra records are removed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {groups.map((group, gi) => {
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>Cancel</Button>
          <Button onClick={handleMerge} disabled={merging || plans.length === 0}>
            {merging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Merge className="w-4 h-4 mr-2" />}
            Merge all ({plans.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
