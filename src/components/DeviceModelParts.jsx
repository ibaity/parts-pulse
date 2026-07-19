import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, Package } from 'lucide-react';

export default function DeviceModelParts({ model }) {
  const [links, setLinks] = useState([]);
  const [parts, setParts] = useState([]);
  const [vendors, setVendors] = useState(new Map());
  const [allItems, setAllItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [linkData, allVendors, items] = await Promise.all([
        base44.entities.DeviceModelItem.filter({ device_model_id: model.id }),
        base44.entities.Vendor.list('-created_date', 100),
        base44.entities.MasterItem.list('-created_date', 500),
      ]);
      setLinks(linkData);
      setVendors(new Map(allVendors.map(v => [v.id, v])));
      setAllItems(items);
      const linkedItems = linkData
        .map(l => items.find(i => i.id === l.master_item_id))
        .filter(Boolean);
      setParts(linkedItems);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load parts', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [model.id]);

  const handleAdd = async () => {
    if (!selectedItem || selectedItem === '_none') return;
    try {
      await base44.entities.DeviceModelItem.create({ device_model_id: model.id, master_item_id: selectedItem });
      setSelectedItem('');
      toast({ title: 'Added', description: 'Part linked to device model' });
      load();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add part', variant: 'destructive' });
    }
  };

  const handleRemove = async (linkId) => {
    try {
      await base44.entities.DeviceModelItem.delete(linkId);
      toast({ title: 'Removed', description: 'Part unlinked' });
      load();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to remove', variant: 'destructive' });
    }
  };

  const unlinkedItems = allItems.filter(i => !links.some(l => l.master_item_id === i.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium">Add Part</label>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger><SelectValue placeholder="Select a master item..." /></SelectTrigger>
              <SelectContent>
                {unlinkedItems.length === 0 ? (
                  <SelectItem value="_none" disabled>All items already linked</SelectItem>
                ) : (
                  unlinkedItems.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.mediserv_item_code || i.manufacturer_item_code || 'No code'} — {i.description?.slice(0, 50) || 'No description'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={!selectedItem || selectedItem === '_none'} size="sm" className="h-9">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </Card>

      {parts.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No parts linked yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add parts from the dropdown above</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Item Code</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-left p-3 font-medium">Vendor</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parts.map(p => {
                  const link = links.find(l => l.master_item_id === p.id);
                  const vendor = vendors.get(p.vendor_id);
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{p.mediserv_item_code || p.manufacturer_item_code || '-'}</td>
                      <td className="p-3">{p.description || '-'}</td>
                      <td className="p-3">
                        {vendor && (
                          <span className="text-xs flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: vendor.color }} />
                            {vendor.name}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(link.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}