import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Monitor, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import DeviceModelDialog from '@/components/DeviceModelDialog';
import DeviceModelParts from '@/components/DeviceModelParts';

export default function DeviceModels() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [partCounts, setPartCounts] = useState({});
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [modelData, links] = await Promise.all([
        base44.entities.DeviceModel.list('-created_date', 200),
        base44.entities.DeviceModelItem.list('-created_date', 500),
      ]);
      setModels(modelData);
      const counts = {};
      links.forEach(l => { counts[l.device_model_id] = (counts[l.device_model_id] || 0) + 1; });
      setPartCounts(counts);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load device models', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (model) => {
    if (!confirm(`Delete "${model.name}"? This will remove all part associations.`)) return;
    try {
      await base44.entities.DeviceModelItem.deleteMany({ device_model_id: model.id });
      await base44.entities.DeviceModel.delete(model.id);
      toast({ title: 'Deleted', description: 'Device model removed' });
      load();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Models
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{selected.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selected.manufacturer || 'Unknown manufacturer'} · {selected.category}
          </p>
        </div>
        <DeviceModelParts model={selected} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Device Models</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage device models and their spare parts lists</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Model
        </Button>
      </div>

      {models.length === 0 ? (
        <Card className="p-12 text-center">
          <Monitor className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No device models yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add a device model to start organizing parts by model</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map(m => (
            <Card key={m.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(m)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-primary" />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditing(m); setDialogOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(m); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <h3 className="font-semibold">{m.name}</h3>
              {m.manufacturer && <p className="text-xs text-muted-foreground mt-0.5">{m.manufacturer}</p>}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{m.category}</span>
                <span className="text-xs text-muted-foreground">{partCounts[m.id] || 0} parts</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <DeviceModelDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={load} />
    </div>
  );
}