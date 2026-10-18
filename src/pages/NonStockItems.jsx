import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NonStockItemDialog, { NON_STOCK_CITIES } from '@/components/NonStockItemDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, PackageOpen, Pencil, Trash2, CheckCircle2, Undo2, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const FILTERS = ['All', ...NON_STOCK_CITIES];

export default function NonStockItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      setItems(await base44.entities.NonStockItem.list('-created_date', 1000));
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load non-stock items', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i =>
      (cityFilter === 'All' || i.city === cityFilter) &&
      (!q || `${i.item_code} ${i.description || ''} ${i.notes || ''}`.toLowerCase().includes(q))
    );
  }, [items, cityFilter, search]);

  const countFor = (f) => items.filter(i => f === 'All' || i.city === f).length;

  const handleAdd = () => { setEditingItem(null); setDialogOpen(true); };
  const handleEdit = (item) => { setEditingItem(item); setDialogOpen(true); };

  const toggleUsed = async (item) => {
    const status = item.status === 'used' ? 'available' : 'used';
    try {
      await base44.entities.NonStockItem.update(item.id, { status });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status } : i));
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await base44.entities.NonStockItem.delete(deleteItem.id);
      toast({ title: 'Deleted', description: `${deleteItem.item_code} has been removed` });
      setDeleteItem(null);
      load();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    }
    setDeleting(false);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <PageHeader icon={PackageOpen} title="Non Stock Items" subtitle="Parts removed from system stock that we still hold and can use, by city">
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-1.5">
          {FILTERS.map(f => (
            <Button
              key={f}
              size="sm"
              variant={cityFilter === f ? 'default' : 'outline'}
              onClick={() => setCityFilter(f)}
            >
              {f} <span className="ml-1.5 opacity-70">{countFor(f)}</span>
            </Button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code or description" className="h-9 pl-8" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-12 text-center">
          <PackageOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No non-stock items</p>
          <p className="text-xs text-muted-foreground mt-1">Add parts that are out of the system but still available in Riyadh or Jeddah.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Item Code</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-right p-3 font-medium">Qty</th>
                  <th className="text-left p-3 font-medium">City</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Notes</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(i => (
                  <tr key={i.id} className={`border-b last:border-0 hover:bg-muted/30 ${i.status === 'used' ? 'opacity-60' : ''}`}>
                    <td className="p-3 font-mono text-xs font-medium">{i.item_code}</td>
                    <td className="p-3">{i.description || '-'}</td>
                    <td className="p-3 text-right tabular-nums">{i.quantity ?? 0}{i.unit ? ` ${i.unit}` : ''}</td>
                    <td className="p-3">{i.city}</td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${i.status === 'used' ? 'bg-muted text-muted-foreground' : 'bg-accent/10 text-accent'}`}>
                        {i.status === 'used' ? 'Used' : 'Available'}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground max-w-[220px] truncate">{i.notes || '-'}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={i.status === 'used' ? 'Mark available' : 'Mark used'} onClick={() => toggleUsed(i)}>
                        {i.status === 'used' ? <Undo2 className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(i)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteItem(i)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <NonStockItemDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
        item={editingItem}
        defaultCity={cityFilter === 'All' ? undefined : cityFilter}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteItem?.item_code}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
