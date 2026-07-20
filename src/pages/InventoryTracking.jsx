import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import SnapshotUploader from '@/components/SnapshotUploader';
import ConsumptionTable from '@/components/ConsumptionTable';
import { calculateConsumption } from '@/lib/consumptionUtils';
import { ClipboardList, TrendingUp, Plus, Calendar, Package } from 'lucide-react';

export default function InventoryTracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(searchParams.get('vendor') || '');
  const [snapshots, setSnapshots] = useState([]);
  const [stockRecords, setStockRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.Vendor.list('-created_date', 100);
        setVendors(data);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedVendor) {
      setSearchParams({ vendor: selectedVendor });
      setLoading(true);
      setShowUploader(false);
      Promise.all([
        base44.entities.InventorySnapshot.filter({ vendor_id: selectedVendor }, '-snapshot_date', 100),
        base44.entities.StockRecord.filter({ vendor_id: selectedVendor }, '-created_date', 1000),
      ]).then(([snaps, records]) => {
        setSnapshots(snaps);
        setStockRecords(records);
      }).catch(err => console.error(err)).finally(() => setLoading(false));
    } else {
      setSnapshots([]);
      setStockRecords([]);
    }
  }, [selectedVendor]);

  const consumptionData = calculateConsumption(stockRecords, snapshots);

  const totalYearlyEst = consumptionData.reduce((sum, i) => sum + (i.yearly_est || 0), 0);
  const criticalCount = consumptionData.filter(i => i.status === 'critical').length;
  const latestSnapshot = snapshots[0];

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full max-w-[1600px]">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardList className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Tracking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Upload inventory snapshots and track consumption rates over time</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Select Vendor</label>
        <Select value={selectedVendor} onValueChange={setSelectedVendor}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="Choose a vendor..." />
          </SelectTrigger>
          <SelectContent>
            {vendors.map(v => (
              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedVendor && (
        loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-medium">Snapshots</span>
                </div>
                <p className="text-2xl font-bold">{snapshots.length}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Package className="w-4 h-4" />
                  <span className="text-xs font-medium">Items Tracked</span>
                </div>
                <p className="text-2xl font-bold">{consumptionData.length}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">Est. Yearly Consumption</span>
                </div>
                <p className="text-2xl font-bold text-primary">{Math.round(totalYearlyEst).toLocaleString('en-US')}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Package className="w-4 h-4" />
                  <span className="text-xs font-medium">Critical Items</span>
                </div>
                <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
              </Card>
            </div>

            {/* Upload section */}
            {showUploader ? (
              <SnapshotUploader
                vendorId={selectedVendor}
                onUploaded={() => {
                  setShowUploader(false);
                  setLoading(true);
                  Promise.all([
                    base44.entities.InventorySnapshot.filter({ vendor_id: selectedVendor }, '-snapshot_date', 100),
                    base44.entities.StockRecord.filter({ vendor_id: selectedVendor }, '-created_date', 1000),
                  ]).then(([snaps, records]) => {
                    setSnapshots(snaps);
                    setStockRecords(records);
                  }).catch(err => console.error(err)).finally(() => setLoading(false));
                }}
              />
            ) : (
              <Button onClick={() => setShowUploader(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Upload New Snapshot
              </Button>
            )}

            {/* Consumption Analysis */}
            {snapshots.length >= 2 ? (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">Consumption Analysis</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Comparing {new Date(snapshots[1].snapshot_date).toLocaleDateString()} → {new Date(snapshots[0].snapshot_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <ConsumptionTable data={consumptionData} />
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {snapshots.length === 0
                    ? 'No snapshots yet. Upload your first inventory file to get started.'
                    : 'Upload at least 2 snapshots to see consumption analysis.'}
                </p>
              </Card>
            )}

            {/* Snapshots list */}
            {snapshots.length > 0 && (
              <Card className="p-4">
                <h2 className="text-lg font-semibold mb-4">Snapshot History</h2>
                <div className="space-y-2">
                  {snapshots.map((snap, idx) => (
                    <div key={snap.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${idx === 0 ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Calendar className={`w-4 h-4 ${idx === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{new Date(snap.snapshot_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                          <p className="text-xs text-muted-foreground">{snap.file_name} {snap.notes ? `· ${snap.notes}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{snap.item_count} items</span>
                        {idx === 0 && <Badge className="bg-primary/10 text-primary">Latest</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )
      )}
    </div>
  );
}