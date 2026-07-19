import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import VendorDialog from '@/components/VendorDialog';
import WarehouseManager from '@/components/WarehouseManager';
import { Plus, Building2, ChevronDown, ChevronRight } from 'lucide-react';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [warehouseCounts, setWarehouseCounts] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Vendor.list('-created_date', 100);
      setVendors(data);
      const allWarehouses = await base44.entities.Warehouse.list('-created_date', 500);
      const counts = {};
      for (const v of data) {
        const whs = allWarehouses.filter(w => w.vendor_id === v.id);
        counts[v.id] = { total: whs.length, enabled: whs.filter(w => w.enabled).length };
      }
      setWarehouseCounts(counts);
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
          <p className="text-sm text-muted-foreground mt-1">Manage vendors and their warehouses</p>
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
        <div className="space-y-3">
          {vendors.map(v => {
            const counts = warehouseCounts[v.id] || { total: 0, enabled: 0 };
            const isExpanded = expandedId === v.id;
            return (
              <Card key={v.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: v.color + '20' }}>
                      <Building2 className="w-5 h-5" style={{ color: v.color }} />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">{v.name}</p>
                      {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Warehouses</p>
                      <p className="text-sm font-medium">{counts.enabled} enabled / {counts.total}</p>
                    </div>
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="p-4 border-t bg-slate-50/50">
                    <h4 className="text-sm font-semibold mb-3">Warehouses & Stock Calculation</h4>
                    <p className="text-xs text-muted-foreground mb-4">Enable warehouses to include them in stock calculations. Warehouse names should match what appears in your PDF reports.</p>
                    <WarehouseManager vendorId={v.id} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <VendorDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={load} />
    </div>
  );
}