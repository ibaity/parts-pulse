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
import { Link } from 'react-router-dom';
import { findCatalogPart } from '@/lib/catalogLookup';
import { PART_CATEGORIES, getCurrencySymbol, fuzzyMatch, showsSar, formatSar } from '@/lib/partConstants';

const COLUMN_DEFS = [
  { key: 'mediserv_item_code', label: 'Mediserv Code' },
  { key: 'manufacturer_item_code', label: 'Manufacturer Code' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'minimum_stock', label: 'Min Stock' },
  { key: 'unit_price', label: 'Unit Price' },
  { key: 'unit', label: 'Unit' },
];

export default function MasterItemsTable({ items, fileId, onDeleted, onSaved, currency, sarRate, stockMap = {}, warehouseNames = [] }) {
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

  const getStock = (item) => {
    const code1 = (item.mediserv_item_code || '').toLowerCase().trim();
    const code2 = (item.manufacturer_item_code || '').toLowerCase().trim();
    return stockMap[code1] || stockMap[code2] || null;
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter(i =>
      fuzzyMatch(search, i.mediserv_item_code) ||
      fuzzyMatch(search, i.manufacturer_item_code) ||
      fuzzyMatch(search, i.description) ||
      fuzzyMatch(search, i.category) ||
      fuzzyMatch(search, i.unit)
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
              <th className="p-2 w-12"></th>
              {visibleCols.mediserv_item_code && <SortHeader label="Mediserv Code" sortKey="mediserv_item_code" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {visibleCols.manufacturer_item_code && <SortHeader label="Manufacturer Code" sortKey="manufacturer_item_code" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {visibleCols.description && <SortHeader label="Description" sortKey="description" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {visibleCols.category && <SortHeader label="Category" sortKey="category" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {visibleCols.minimum_stock && <SortHeader label="Min Stock" sortKey="minimum_stock" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />}
              {visibleCols.unit_price && <SortHeader label={`Price (${currencySymbol})`} sortKey="unit_price" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />}
              {visibleCols.unit && <SortHeader label="Unit" sortKey="unit" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />}
              {warehouseNames.map(wh => (
                <th key={wh} className="text-right p-2 font-medium whitespace-nowrap text-xs">{wh}</th>
              ))}
              {warehouseNames.length > 0 && (
                <th className="text-right p-2 font-medium whitespace-nowrap text-xs">Total</th>
              )}
              <th className="text-center p-2 font-medium whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(item => {
              const isDirty = !!edits[item.id];
              return (
                <tr key={item.id} className={`border-b transition-colors ${isDirty ? 'bg-warning/10' : 'hover:bg-muted/40'}`}>
                  <td className="p-1 w-12">
                    {(() => {
                      const part = findCatalogPart(item.manufacturer_item_code, item.mediserv_item_code);
                      if (!part) return null;
                      return (
                        <Link to={`/parts-catalog?q=${encodeURIComponent(part.partNo)}`} title={`${part.name} — open in Parts Catalog`}>
                          {part.image
                            ? <img src={`/catalog/img/${part.image}`} alt={part.name} loading="lazy" className="w-10 h-10 object-contain bg-white rounded border" />
                            : <span className="block w-10 h-10 rounded border bg-muted" />}
                        </Link>
                      );
                    })()}
                  </td>
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
                          step="0.01"
                          className="w-24 bg-transparent rounded px-1 py-1 text-right text-xs font-medium focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                          value={edits[item.id]?.unit_price !== undefined ? edits[item.id].unit_price : (item.unit_price ?? '') === '' ? '' : Number(item.unit_price).toFixed(2)}
                          onChange={e => updateField(item.id, 'unit_price', e.target.value)}
                        />
                      </div>
                      {showsSar(currency, sarRate) && Number(getValue(item, 'unit_price')) > 0 && (
                        <bdi className="block pr-1 text-right text-[10px] text-muted-foreground tabular-nums">≈ {formatSar(getValue(item, 'unit_price'), sarRate)}</bdi>
                      )}
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
                  {warehouseNames.map(wh => {
                    const stock = getStock(item);
                    const qty = stock?.breakdown?.[wh]?.quantity;
                    return (
                      <td key={wh} className="p-2 text-right text-xs">
                        {qty !== undefined ? qty : '—'}
                      </td>
                    );
                  })}
                  {warehouseNames.length > 0 && (
                    <td className="p-2 text-right text-xs font-semibold">
                      {getStock(item)?.total ?? '—'}
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