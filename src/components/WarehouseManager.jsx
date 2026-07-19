import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Warehouse } from 'lucide-react';

export default function WarehouseManager({ vendorId }) {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Warehouse.filter({ vendor_id: vendorId });
      setWarehouses(data);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load warehouses', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [vendorId]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await base44.entities.Warehouse.create({
        vendor_id: vendorId,
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

  const handleToggle = async (wh) => {
    try {
      await base44.entities.Warehouse.update(wh.id, { enabled: !wh.enabled });
      load();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update warehouse', variant: 'destructive' });
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground py-4">Loading warehouses...</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Warehouse Name</Label>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Riyadh Main" className="h-9" />
        </div>
        <div className="w-28 space-y-1">
          <Label className="text-xs">Code</Label>
          <Input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="RUH" className="h-9" />
        </div>
        <Button onClick={handleAdd} disabled={adding || !newName.trim()} size="sm" className="h-9">
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>
      {warehouses.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No warehouses yet. Add warehouses that match the names in your PDF reports.</p>
      ) : (
        <div className="space-y-2">
          {warehouses.map(wh => (
            <Card key={wh.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Warehouse className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{wh.name}</p>
                  {wh.code && <p className="text-xs text-muted-foreground">{wh.code}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${wh.enabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {wh.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <Switch checked={wh.enabled} onCheckedChange={() => handleToggle(wh)} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}