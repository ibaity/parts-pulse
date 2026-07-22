import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Warehouse as WarehouseIcon, Trash2 } from 'lucide-react';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Warehouse.list('-created_date', 200);
      setWarehouses(data);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load warehouses', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await base44.entities.Warehouse.create({
        name: newName.trim(),
        code: newCode.trim(),
        enabled: true,
      });
      setNewName('');
      setNewCode('');
      load();
      toast({ title: 'Success', description: 'Warehouse added' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add warehouse', variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleUpdate = async (wh, field, value) => {
    try {
      await base44.entities.Warehouse.update(wh.id, { [field]: value });
      setWarehouses(prev => prev.map(w => w.id === wh.id ? { ...w, [field]: value } : w));
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update warehouse', variant: 'destructive' });
    }
  };

  const handleDelete = async (wh) => {
    try {
      await base44.entities.Warehouse.delete(wh.id);
      load();
      toast({ title: 'Deleted', description: 'Warehouse removed' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete warehouse', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
        <p className="text-sm text-muted-foreground mt-1">Warehouses are auto-detected from PDF analyses. Configure importance, stock inclusion, and visibility per warehouse.</p>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Add New Warehouse</h3>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Location / Name</Label>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Riyadh Main Store" className="h-9" />
          </div>
          <div className="w-full sm:w-32 space-y-1">
            <Label className="text-xs">Code</Label>
            <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="RUH" className="h-9" />
          </div>
          <Button onClick={handleAdd} disabled={adding || !newName.trim()} size="sm" className="h-9">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : warehouses.length === 0 ? (
        <Card className="p-12 text-center">
          <WarehouseIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No warehouses defined yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add warehouses above. They will be used across all vendor analyses.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Location</th>
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-center p-3 font-medium">Important</th>
                <th className="text-center p-3 font-medium">Count in Stock</th>
                <th className="text-center p-3 font-medium">Visible</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map(wh => (
                <tr key={wh.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <WarehouseIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{wh.name}</span>
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{wh.code || '-'}</td>
                  <td className="p-3 text-center">
                    <Switch checked={!!wh.important} onCheckedChange={(v) => handleUpdate(wh, 'important', v)} />
                  </td>
                  <td className="p-3 text-center">
                    <Switch checked={wh.enabled} onCheckedChange={(v) => handleUpdate(wh, 'enabled', v)} />
                  </td>
                  <td className="p-3 text-center">
                    <Switch checked={wh.visible !== false} onCheckedChange={(v) => handleUpdate(wh, 'visible', v)} />
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(wh)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
    </div>
  );
}