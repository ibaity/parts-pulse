import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Columns3, Check, Trash2, Loader2 } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import SortHeader from '@/components/table/SortHeader';

const CATEGORIES = [
  'High Rotation',
  'Medium Rotation',
  'Slow Moving',
  'On Demand',
  'Obsolete',
];

const COLUMN_DEFS = [
  { key: 'item_code', label: 'PDF Code' },
  { key: 'mediserv_item_code', label: 'Mediserv Code' },
  { key: 'manufacturer_item_code', label: 'Manufacturer Code' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'minimum_stock', label: 'Min Stock' },
  { key: 'unit', label: 'Unit' },
];

export default function UnknownItemsTable({ items, vendorId, onSaved, onDeleted }) {
  const [search, setSearch] = useState('');
  const [edits, setEdits] = useState({});
  const [savingIds, setSavingIds] = useState(new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    item_code: true,
    mediserv_item_code: true,
    manufacturer_item_code: true,
    description: true,
    category: true,
    minimum_stock: true,
    unit: true,
  });
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      (i.item_code || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered);

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
        unit: edit.unit || '',
      });
      await base44.entities.AnalysisItem.update(itemId, { matched_via: 'mediserv_code' });
      toast({ title: 'Saved', description: 'Item added to master list' });
      setEdits(prev => { const c = { ...prev }; delete c[itemId]; return c; });
      onSaved(itemId);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save item', variant: 'destructive' });
    }
    setSavingIds(prev => { const c = new Set(prev); c.delete(itemId); return c; });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.AnalysisItem.delete(deleteTarget.id);
      toast({ title: 'Deleted', description: 'Unknown item removed' });
      setEdits(prev => { const c = { ...prev }; delete c[deleteTarget.id]; return c; });
      onDeleted?.(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    }
    setDeleting(false);
  };

  const handleSaveAll = async () => {
    const ids = sorted.map(i => i.id);
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
          unit: edit.unit || '',
        });
        await base44.entities.AnalysisItem.update(id, { matched_via: 'mediserv_code' });
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
          <Button onClick={handleSaveAll} size="sm" variant="default">
            Save All to Master
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this unknown item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.description || deleteTarget?.item_code || 'this item'}"? This action cannot be undone.
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

      <div className="overflow-auto max-h-[400px] border rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 backdrop-blur-sm sticky top-0 z-10 border-b">
            <tr>
              {visibleCols.item_code && <SortHeader label="PDF Code" sortKey="item_code" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {visibleCols.mediserv_item_code && <th className="text-left p-2 font-medium whitespace-nowrap">Mediserv Code</th>}
              {visibleCols.manufacturer_item_code && <th className="text-left p-2 font-medium whitespace-nowrap">Manufacturer Code</th>}
              {visibleCols.description && <SortHeader label="Description" sortKey="description" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {visibleCols.category && <th className="text-left p-2 font-medium whitespace-nowrap">Category</th>}
              {visibleCols.minimum_stock && <SortHeader label="Min Stock" sortKey="minimum_stock" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />}
              {visibleCols.unit && <th className="text-left p-2 font-medium whitespace-nowrap">Unit</th>}
              <th className="text-center p-2 font-medium whitespace-nowrap">Save</th>
              <th className="text-center p-2 font-medium whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(item => (
              <tr key={item.id} className="border-b transition-colors hover:bg-muted/40">
                {visibleCols.item_code && <td className="p-1 font-mono text-xs text-muted-foreground whitespace-nowrap">{item.item_code || '-'}</td>}
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
                      placeholder="—"
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
                {visibleCols.unit && (
                  <td className="p-1">
                    <input
                      className="w-20 bg-transparent rounded px-1 py-1 text-xs focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                      placeholder="—"
                      value={getValue(item, 'unit')}
                      onChange={e => updateField(item.id, 'unit', e.target.value)}
                    />
                  </td>
                )}
                <td className="p-1 text-center whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={savingIds.has(item.id)}
                    onClick={() => handleSave(item.id)}
                  >
                    {savingIds.has(item.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                  </Button>
                </td>
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
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No unknown items.</div>
        )}
      </div>
    </div>
  );
}