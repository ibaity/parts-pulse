import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/fetchAll';
import { groupUnknownItems, findMasterDuplicates } from '@/lib/dedupe';
import { Card } from '@/components/ui/card';
import MasterItemsTable from '@/components/MasterItemsTable';
import UnknownItemsTable from '@/components/UnknownItemsTable';
import MasterItemDialog from '@/components/MasterItemDialog';
import { Button } from '@/components/ui/button';
import { PackageSearch, AlertCircle, Plus, Clock, Copy, Tag } from 'lucide-react';
import PriceUpdateDialog from '@/components/PriceUpdateDialog';
import MergeDuplicatesDialog from '@/components/MergeDuplicatesDialog';
import { getCurrencySymbol } from '@/lib/partConstants';
import PageHeader from '@/components/PageHeader';
import VendorNotice from '@/components/VendorNotice';
import { useVendorSelection } from '@/hooks/useVendors';

const TABS = [
  { key: 'master', label: 'Master Items', icon: PackageSearch },
  { key: 'unknown', label: 'Unknown Items', icon: AlertCircle },
];

export default function PartList() {
  const [, setSearchParams] = useSearchParams();
  const { selectedVendor } = useVendorSelection();
  const [masterItems, setMasterItems] = useState([]);
  const [unknownItems, setUnknownItems] = useState([]);
  const [fileCurrency, setFileCurrency] = useState('SAR');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('master');
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [stockMap, setStockMap] = useState({});
  const [warehouseNames, setWarehouseNames] = useState([]);
  const [lastStockUpdate, setLastStockUpdate] = useState(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const { groups: duplicateGroups, suspicious: suspiciousGroups } = useMemo(() => findMasterDuplicates(masterItems), [masterItems]);
  const extraRecords = duplicateGroups.reduce((n, g) => n + g.length - 1, 0);
  const reloadMaster = () => fetchAll(base44.entities.MasterItem, { vendor_id: selectedVendor }).then(setMasterItems);

  useEffect(() => {
    if (selectedVendor) {
      setSearchParams({ vendor: selectedVendor });
      setLoading(true);
      Promise.all([
        fetchAll(base44.entities.MasterItem, { vendor_id: selectedVendor }),
        fetchAll(base44.entities.AnalysisItem, { vendor_id: selectedVendor, matched_via: 'none' }),
        base44.entities.MasterFile.filter({ vendor_id: selectedVendor }, '-created_date', 100),
      ]).then(([master, unknown, files]) => {
        setMasterItems(master);
        if (files.length > 0 && files[0].currency) {
          setFileCurrency(files[0].currency);
        }
        setUnknownItems(groupUnknownItems(unknown, master));
      }).catch(err => console.error(err)).finally(() => setLoading(false));

      // Fetch latest stock data from analysis
      base44.entities.AnalysisRun.filter({ vendor_id: selectedVendor, status: 'completed' }, '-created_date', 1)
        .then(async (runs) => {
          if (runs.length === 0) {
            setStockMap({});
            setWarehouseNames([]);
            setLastStockUpdate(null);
            return;
          }
          const latestRun = runs[0];
          setLastStockUpdate(latestRun.created_date);
          const items = await fetchAll(base44.entities.AnalysisItem, { analysis_run_id: latestRun.id });
          const map = {};
          const whNames = new Set();
          items.forEach(ai => {
            const code = (ai.item_code || '').toLowerCase().trim();
            if (code) {
              map[code] = {
                total: ai.current_stock || 0,
                breakdown: ai.warehouse_breakdown || {},
              };
              if (ai.warehouse_breakdown) {
                Object.keys(ai.warehouse_breakdown).forEach(k => whNames.add(k));
              }
            }
          });
          setStockMap(map);
          setWarehouseNames([...whNames].sort());
        })
        .catch(err => console.error(err));
    } else {
      setMasterItems([]);
      setUnknownItems([]);
      setStockMap({});
      setWarehouseNames([]);
      setLastStockUpdate(null);
    }
  }, [selectedVendor]);

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <PageHeader icon={PackageSearch} title="Part List" subtitle="Manage all parts and classify unknown items from stock reports" />

      <VendorNotice />

      {selectedVendor && lastStockUpdate && (
        <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm text-muted-foreground">Last stock update:</span>
          <span className="text-sm font-semibold text-primary">
            {new Date(lastStockUpdate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">Based on latest PDF analysis</span>
        </div>
      )}

      {selectedVendor && (
        loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Pill Tab Bar */}
            <div className="inline-flex items-center gap-1 bg-muted rounded-xl p-1 border overflow-x-auto max-w-full">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const count = tab.key === 'unknown' ? unknownItems.length : masterItems.length;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary-foreground/20' : 'bg-muted-foreground/15'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <Card className="p-4">
              {activeTab === 'unknown' ? (
                <>
                  {unknownItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No unknown items. All matched!</p>
                  ) : (
                    <UnknownItemsTable
                     items={unknownItems}
                     vendorId={selectedVendor}
                     onSaved={(id) => {
                       setUnknownItems(prev => prev.filter(i => i.id !== id));
                       setMasterItems(prev => [...prev]);
                     }}
                     onDeleted={(id) => setUnknownItems(prev => prev.filter(i => i.id !== id))}
                    />
                  )}
                </>
              ) : (
                <>
                  {(duplicateGroups.length > 0 || suspiciousGroups.length > 0) && (
                    <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl border border-warning/30 bg-warning/5">
                      <Copy className="w-4 h-4 text-warning shrink-0" />
                      <p className="text-sm">
                        <span className="font-semibold">{duplicateGroups.length} parts are recorded more than once</span>
                        <span className="text-muted-foreground"> ({extraRecords} extra records)</span>
                        {suspiciousGroups.length > 0 && (
                          <span className="text-muted-foreground"> · {suspiciousGroups.length} groups need manual review</span>
                        )}
                      </p>
                      <Button size="sm" variant="outline" className="sm:ml-auto" onClick={() => setMergeOpen(true)}>
                        Review &amp; merge
                      </Button>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 mb-3">
                    <Button size="sm" variant="outline" onClick={() => setPriceOpen(true)}>
                      <Tag className="w-4 h-4 mr-1" /> Update prices
                    </Button>
                    <Button size="sm" onClick={() => setAddPartOpen(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Add Part
                    </Button>
                  </div>
                  {masterItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No master items yet. Upload a master file first.</p>
                  ) : (
                    <MasterItemsTable
                      items={masterItems}
                      currency={fileCurrency}
                      stockMap={stockMap}
                      warehouseNames={warehouseNames}
                      onDeleted={(id) => setMasterItems(prev => prev.filter(i => i.id !== id))}
                      onSaved={(edits) => {
                        setMasterItems(prev => prev.map(item => {
                          if (!edits[item.id]) return item;
                          const changes = { ...edits[item.id] };
                          if (changes.minimum_stock !== undefined) {
                            changes.minimum_stock = Number(changes.minimum_stock) || 0;
                          }
                          if (changes.unit_price !== undefined) {
                            changes.unit_price = Number(changes.unit_price) || 0;
                          }
                          return { ...item, ...changes };
                        }));
                      }}
                    />
                  )}
                </>
              )}
            </Card>
          </>
        )
      )}

      <PriceUpdateDialog
        open={priceOpen}
        onOpenChange={setPriceOpen}
        vendorId={selectedVendor}
        masterItems={masterItems}
        currency={getCurrencySymbol(fileCurrency)}
        onUpdated={reloadMaster}
      />

      <MergeDuplicatesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        groups={duplicateGroups}
        suspicious={suspiciousGroups}
        currency={getCurrencySymbol(fileCurrency)}
        onMerged={reloadMaster}
      />

      <MasterItemDialog
        open={addPartOpen}
        onOpenChange={setAddPartOpen}
        vendorId={selectedVendor}
        currency={fileCurrency}
        onSaved={reloadMaster}
      />
    </div>
  );
}