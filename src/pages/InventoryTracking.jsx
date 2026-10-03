import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/fetchAll';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SnapshotUploader from '@/components/SnapshotUploader';
import ConsumptionTable from '@/components/ConsumptionTable';
import { calculateConsumption } from '@/lib/consumptionUtils';
import { ClipboardList, TrendingUp, Plus, Calendar, Package } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import VendorNotice from '@/components/VendorNotice';
import { useVendorSelection } from '@/hooks/useVendors';

export default function InventoryTracking() {
  const [, setSearchParams] = useSearchParams();
  const { selectedVendor } = useVendorSelection();
  const [snapshots, setSnapshots] = useState([]);
  const [stockRecords, setStockRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  // Consumption only compares the two latest snapshots, so load just their records (all of them).
  const loadData = async () => {
    setLoading(true);
    try {
      const snaps = await base44.entities.InventorySnapshot.filter({ vendor_id: selectedVendor }, '-snapshot_date', 100);
      const latestTwo = [...snaps]
        .sort((a, b) => new Date(b.snapshot_date) - new Date(a.snapshot_date))
        .slice(0, 2);
      const recordLists = await Promise.all(
        latestTwo.map(snap => fetchAll(base44.entities.StockRecord, { snapshot_id: snap.id }))
      );
      setSnapshots(snaps);
      setStockRecords(recordLists.flat());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedVendor) {
      setSearchParams({ vendor: selectedVendor });
      setLoading(true);
      setShowUploader(false);
      loadData();
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
    <div className="p-4 sm:p-8 space-y-6">
      <PageHeader icon={ClipboardList} title="Stock Tracking" subtitle="Upload inventory snapshots and track consumption rates over time" />

      <VendorNotice />

      {selectedVendor && (
        loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
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
                <p className="text-2xl font-bold text-critical">{criticalCount}</p>
              </Card>
            </div>

            {/* Upload section */}
            {showUploader ? (
              <SnapshotUploader
                vendorId={selectedVendor}
                onUploaded={() => {
                  setShowUploader(false);
                  loadData();
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