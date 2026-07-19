import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import VendorDialog from '@/components/VendorDialog';
import { Plus, Building2 } from 'lucide-react';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Vendor.list('-created_date', 100);
      setVendors(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage vendor profiles</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Vendor
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : vendors.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No vendors yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first vendor to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {vendors.map(v => (
            <Card key={v.id} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: v.color + '20' }}>
                <Building2 className="w-5 h-5" style={{ color: v.color }} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{v.name}</p>
                {v.description && <p className="text-xs text-muted-foreground truncate">{v.description}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <VendorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={load} />
    </div>
  );
}