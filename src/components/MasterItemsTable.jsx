import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Search, Save, Loader2, Check } from 'lucide-react';

const CATEGORIES = [
  'High Rotation',
  'Medium Rotation',
  'Slow Moving',
  'On Demand',
  'Obsolete',
];

export default function MasterItemsTable({ items, fileId }) {
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      (i.mediserv_item_code || '').toLowerCase().includes(q) ||
      (i.manufacturer_item_code || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const dirtyIds = Object.keys(edits);

  const updateField = (id, field, value) => {
    setEdits(prev => {
      const current = prev[id] || {};
      const original = items.find(i => i.id === id) || {};
      // If value matches original, remove from dirty
      if (String(original[field] ?? '') === String(value)) {
        const next = { ...current };
        delete next[field];
        if (Object.keys(next).length === 0) {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        }
        return { ...prev, [id]: next };
      }
      return { ...prev, [id]: { ...current, [field]: value } };
    });
  };

  const getValue = (item, field) => {
    if (edits[item.id] && edits[item.id][field] !== undefined) {
      return edits[item.id][field];
    }
    return item[field] ?? '';
  };

  const handleSave = async () => {
    if (dirtyIds.length === 0) return;
    setSaving(true);
    try {
      const updates = dirtyIds.map(id => ({
        id,
        ...edits[id],
        minimum_stock: edits[id].minimum_stock !== undefined
          ? Number(edits[id].minimum_stock) || 0
          : undefined,
      }));
      await base44.entities.MasterItem.bulkUpdate(updates);
      toast({ title: 'Saved', description: `${updates.length} item(s) updated` });
      setEdits({});
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code, description, or category..."
            className="pl-9 h-9"
          />
        </div>
        {dirtyIds.length > 0 && (
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes ({dirtyIds.length})
          </Button>
        )}
      </div>

      <div className="overflow-auto max-h-[500px] border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className="text-left p-2 font-medium whitespace-nowrap">Mediserv Code</th>
              <th className="text-left p-2 font-medium whitespace-nowrap">Manufacturer Code</th>
              <th className="text-left p-2 font-medium whitespace-nowrap">Description</th>
              <th className="text-left p-2 font-medium whitespace-nowrap">Category</th>
              <th className="text-right p-2 font-medium whitespace-nowrap">Min Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const isDirty = !!edits[item.id];
              return (
                <tr key={item.id} className={`border-b ${isDirty ? 'bg-amber-50' : 'hover:bg-muted/30'}`}>
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
                      <SelectTrigger className="h-7 text-xs w-[140px]">
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
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No items match your search.</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {items.length} items · Click any cell to edit · Changes highlighted in amber
      </p>
    </div>
  );
}