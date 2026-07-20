import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { Search, Save, Loader2, Trash2, Columns3, Check } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/table/SortHeader';
import { PART_CATEGORIES, getCurrencySymbol } from '@/lib/partConstants';

const COLUMN_DEFS = [
  { key: 'mediserv_item_code', label: 'Mediserv Code' },
  { key: 'manufacturer_item_code', label: 'Manufacturer Code' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'minimum_stock', label: 'Min Stock' },
  { key: 'unit_price', label: 'Unit Price' },
  { key: 'unit', label: 'Unit' },
];

export default function MasterItemsTable({ items, fileId, onDeleted, onSaved, currency }) {
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    mediserv_item_code: true,
    manufacturer_item_code: true,
    description: true,
    category: true,
    minimum_stock: true,
    unit_price: true,
    unit: true,
  });
  const { toast } = useToast();

  const currencySymbol = getCurrencySymbol(currency);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      (i.mediserv_item_code || '').toLowerCase().includes(q) ||
      (i.manufacturer_item_code || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.unit || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered);

  const dirtyIds = Object.keys(edits);

  const updateField = (id, field, value) => {
    setEdits(prev => {
      const current = prev[id] || {};
      const original = items.find(i => i.id === id) || {};
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
        unit_price: edits[id].unit_price !== undefined
          ? Number(edits[id].unit_price) || 0
          : undefined,
      }));
      await base44.entities.MasterItem.bulkUpdate(updates);
      toast({ title: 'Saved', description: `${updates.length} item(s) updated` });
      onSaved?.(edits);
      setEdits({});
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.MasterItem.delete(deleteTarget.id);
      toast({ title: 'Deleted', description: 'Item removed from master list' });
      setEdits(prev => { const c = { ...prev }; delete c[deleteTarget.id]; return c; });
      onDeleted?.(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    }
    setDeleting(false);
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
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Columns3 className="w-4 h-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMN_DEFS.map(col => (
                <DropdownMenuItem
                  key={col.key}
                  onClick={() => setVisibleCols(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                  className="cursor-pointer flex items-center justify-between"
                >
                  <span>{col.label}</span>
                  {visibleCols[col.key] && <Check className="w-3.5 h-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {dirtyIds.length > 0 && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes ({dirtyIds.length})
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-auto max-h-[500px] border rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 backdrop-blur-sm sticky top-0 z-10 border-b">
            <tr>
              {visibleCols.mediserv_item_code && <SortHeader label="Mediserv Code" sortKey="mediserv_item_code" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {visibleCols.manufacturer_item_code && <SortHeader label="Manufacturer Code" sortKey="manufacturer_item_code" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {visibleCols.description && <SortHeader label="Description" sortKey="description" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {visibleCols.category && <SortHeader label="Category" sortKey="category" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {visibleCols.minimum_stock && <SortHeader label="Min Stock" sortKey="minimum_stock" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />}
              {visibleCols.unit_price && <SortHeader label={`Price (${currencySymbol})`} sortKey="unit_price" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />}
              {visibleCols.unit && <SortHeader label="Unit" sortKey="unit" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              <th className="text-center p-2 font-medium whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(item => {
              const isDirty = !!edits[item.id];
              return (
                <tr key={item.id} className={`border-b transition-colors ${isDirty ? 'bg-amber-50' : 'hover:bg-muted/40'}`}>
                  {visibleCols.mediserv_item_code && (
                    <td className="p-1">
                      <input
                        className="w-full bg-transparent rounded px-1 py-1 font-mono text-xs focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                        value={getValue(item, 'mediserv_item_code')}
                        onChange={e => updateField(item.id, 'mediserv_item_code', e.target.value)}
                      />
                    </td>
                  )}
                  {visibleCols.manufacturer_item_code && (
                    <td className="p-1">
                      <input
                        className="w-full bg-transparent rounded px-1 py-1 font-mono text-xs focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                        value={getValue(item, 'manufacturer_item_code')}
                        onChange={e => updateField(item.id, 'manufacturer_item_code', e.target.value)}
                      />
                    </td>
                  )}
                  {visibleCols.description && (
                    <td className="p-1">
                      <input
                        className="w-full bg-transparent rounded px-1 py-1 text-xs focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                        value={getValue(item, 'description')}
                        onChange={e => updateField(item.id, 'description', e.target.value)}
                      />
                    </td>
                  )}
                  {visibleCols.category && (
                    <td className="p-1">
                      <Select
                        value={getValue(item, 'category') || 'uncategorized'}
                        onValueChange={v => updateField(item.id, 'category', v === 'uncategorized' ? '' : v)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="uncategorized">— None —</SelectItem>
                          {PART_CATEGORIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label} <span className="text-muted-foreground text-[10px]">({c.desc})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                  {visibleCols.minimum_stock && (
                    <td className="p-1">
                      <input
                        type="number"
                        className="w-20 bg-transparent rounded px-1 py-1 text-right text-xs font-medium focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                        value={getValue(item, 'minimum_stock')}
                        onChange={e => updateField(item.id, 'minimum_stock', e.target.value)}
                      />
                    </td>
                  )}
                  {visibleCols.unit_price && (
                    <td className="p-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground shrink-0">{currencySymbol}</span>
                        <input
                          type="number"
                          className="w-24 bg-transparent rounded px-1 py-1 text-right text-xs font-medium focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                          value={getValue(item, 'unit_price')}
                          onChange={e => updateField(item.id, 'unit_price', e.target.value)}
                        />
                      </div>
                    </td>
                  )}
                  {visibleCols.unit && (
                    <td className="p-1">
                      <input
                        className="w-20 bg-transparent rounded px-1 py-1 text-xs focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                        value={getValue(item, 'unit')}
                        onChange={e => updateField(item.id, 'unit', e.target.value)}
                      />
                    </td>
                  )}
                  <td className="p-1 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No items match your search.</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {sorted.length} of {items.length} items · Click any cell to edit · Changes highlighted in amber
      </p>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.description || deleteTarget?.mediserv_item_code || 'this item'}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}