import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Search } from 'lucide-react';

const CATEGORIES = [
  'Reagents',
  'Consumables',
  'Spare Parts',
  'Calibrators',
  'Controls',
  'Accessories',
  'Other',
];

export default function UnknownItemsTable({ items, vendorId, onSaved }) {
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      (i.item_code || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const updateField = (id, field, value) => {
    setEdits(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const getValue = (item, field) => {
    if (edits[item.id] && edits[item.id][field] !== undefined) {
      return edits[item.id][field];
    }
    if (field === 'mediserv_item_code') return item.item_code ?? '';
    return item[field] ?? '';
  };

  const handleSave = async (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const edit = edits[itemId] || {};

    setSavingIds(prev => new Set(prev).add(itemId));
    try {
      await base44.entities.MasterItem.create({
        vendor_id: vendorId,
        mediserv_item_code: edit.mediserv_item_code ?? item.item_code ?? '',
        manufacturer_item_code: edit.manufacturer_item_code ?? '',
        description: edit.description ?? item.description ?? '',
        minimum_stock: Number(edit.minimum_stock) || 0,
        category: edit.category || '',
      });
      toast({ title: 'Saved', description: 'Item added to master list' });
      setEdits(prev => { const c = { ...prev }; delete c[itemId]; return c; });
      onSaved(itemId);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save item', variant: 'destructive' });
    }
    setSavingIds(prev => { const c = new Set(prev); c.delete(itemId); return c; });
  };

  const handleSaveAll = async () => {
    const ids = filtered.map(i => i.id);
    setSavingIds(new Set(ids));
    try {
      for (const id of ids) {
        const item = items.find(i => i.id === id);
        const edit = edits[id] || {};
        await base44.entities.MasterItem.create({
          vendor_id: vendorId,
          mediserv_item_code: edit.mediserv_item_code ?? item.item_code ?? '',
          manufacturer_item_code: edit.manufacturer_item_code ?? '',
          description: edit.description ?? item.description ?? '',
          minimum_stock: Number(edit.minimum_stock) || 0,
          category: edit.category || '',
        });
        onSaved(id);
      }
      toast({ title: 'Saved', description: `${ids.length} item(s) added to master list` });
      setEdits({});
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save some items', variant: 'destructive' });
    }
    setSavingIds(new Set());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search unknown items..."
            className="pl-9 h-9"
          />
        </div>
        <Button onClick={handleSaveAll} size="sm" variant="default">
          Save All to Master
        </Button>
      </div>

      <div className="overflow-auto max-h-[400px] border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="text-left p-2 font-medium whitespace-nowrap">PDF Code</th>
              <th className="text-left p-2 font-medium whitespace-nowrap">Mediserv Code</th>
              <th className="text-left p-2 font-medium whitespace-nowrap">Manufacturer Code</th>
              <th className="text-left p-2 font-medium whitespace-nowrap">Description</th>
              <th className="text-left p-2 font-medium whitespace-nowrap">Category</th>
              <th className="text-right p-2 font-medium whitespace-nowrap">Min Stock</th>
              <th className="text-center p-2 font-medium whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.id} className="border-b hover:bg-muted/30">
                <td className="p-1 font-mono text-xs text-muted-foreground whitespace-nowrap">{item.item_code || '-'}</td>
                <td className="p-1">
                  <input
                    className="w-full bg-transparent rounded px-1 py-1 font-mono text-xs focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                    value={getValue(item, 'mediserv_item_code')}
                    onChange={e => updateField(item.id, 'mediserv_item_code', e.target.value)}
                  />
                </td>
                <td className="p-1">
                  <input
                    className="w-full bg-transparent rounded px-1 py-1 font-mono text-xs focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                    placeholder="—"
                    value={getValue(item, 'manufacturer_item_code')}
                    onChange={e => updateField(item.id, 'manufacturer_item_code', e.target.value)}
                  />
                </td>
                <td className="p-1">
                  <input
                    className="w-full bg-transparent rounded px-1 py-1 text-xs focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                    value={getValue(item, 'description')}
                    onChange={e => updateField(item.id, 'description', e.target.value)}
                  />
                </td>
                <td className="p-1">
                  <Select
                    value={getValue(item, 'category') || 'uncategorized'}
                    onValueChange={v => updateField(item.id, 'category', v === 'uncategorized' ? '' : v)}
                  >
                    <SelectTrigger className="h-7 text-xs w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uncategorized">— None —</SelectItem>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1">
                  <input
                    type="number"
                    className="w-20 bg-transparent rounded px-1 py-1 text-right text-xs font-medium focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                    value={getValue(item, 'minimum_stock')}
                    onChange={e => updateField(item.id, 'minimum_stock', e.target.value)}
                  />
                </td>
                <td className="p-1 text-center whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={savingIds.has(item.id)}
                    onClick={() => handleSave(item.id)}
                  >
                    {savingIds.has(item.id) ? '...' : 'Save'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No unknown items.</div>
        )}
      </div>
    </div>
  );
}