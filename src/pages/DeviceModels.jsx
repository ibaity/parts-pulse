import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Monitor, Pencil, Trash2, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import DeviceModelDialog from '@/components/DeviceModelDialog';
import DeviceModelParts from '@/components/DeviceModelParts';

export default function DeviceModels() {
  const [models, setModels] = useState([]);
  const [vendors, setVendors] = useState(new Map());
  const [masterFiles, setMasterFiles] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [modelData, vendorData, fileData] = await Promise.all([
        base44.entities.DeviceModel.list('-created_date', 200),
        base44.entities.Vendor.list('-created_date', 200),
        base44.entities.MasterFile.list('-created_date', 200),
      ]);
      setModels(modelData);
      setVendors(new Map(vendorData.map(v => [v.id, v])));
      setMasterFiles(new Map(fileData.map(f => [f.id, f])));
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load device models', variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (model) => {
    if (!confirm(`Delete "${model.name}"?`)) return;
    try {
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
        <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (selected) {
    const vendor = vendors.get(selected.vendor_id);
    const masterFile = masterFiles.get(selected.master_file_id);
    return (
      <div className="p-4 sm:p-8 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Models
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{selected.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {vendor?.name || 'Unknown vendor'}{masterFile ? ` · ${masterFile.file_name}` : ''}
          </p>
        </div>
        <DeviceModelParts model={selected} vendor={vendor} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <PageHeader icon={Monitor} title="Device Models" subtitle="Manage device models linked to master part sheets">
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Model
        </Button>
      </PageHeader>

      {models.length === 0 ? (
        <Card className="p-12 text-center">
          <Monitor className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No device models yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add a device model and link it to a master sheet</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map(m => {
            const vendor = vendors.get(m.vendor_id);
            const masterFile = masterFiles.get(m.master_file_id);
            return (
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
                {vendor && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: vendor.color }} />
                    {vendor.name}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  {masterFile ? (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                      <FileSpreadsheet className="w-3 h-3" />
                      {masterFile.item_count} parts
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No master sheet linked</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <DeviceModelDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSaved={load} />
    </div>
  );
}