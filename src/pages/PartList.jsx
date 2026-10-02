import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/fetchAll';
import { Card } from '@/components/ui/card';
import MasterItemsTable from '@/components/MasterItemsTable';
import UnknownItemsTable from '@/components/UnknownItemsTable';
import MasterItemDialog from '@/components/MasterItemDialog';
import { Button } from '@/components/ui/button';
import { PackageSearch, AlertCircle, Plus, Clock, Check, Building2 } from 'lucide-react';
import { useVendorSelection } from '@/hooks/useVendors';

const TABS = [
  { key: 'master', label: 'Master Items', icon: PackageSearch },
  { key: 'unknown', label: 'Unknown Items', icon: AlertCircle },
];

export default function PartList() {
  const [, setSearchParams] = useSearchParams();
  const { vendors, selectedVendor, setSelectedVendor } = useVendorSelection();
  const [masterItems, setMasterItems] = useState([]);
  const [unknownItems, setUnknownItems] = useState([]);
  const [fileCurrency, setFileCurrency] = useState('SAR');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('master');
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [stockMap, setStockMap] = useState({});
  const [warehouseNames, setWarehouseNames] = useState([]);
  const [lastStockUpdate, setLastStockUpdate] = useState(null);

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
        const masterCodes = new Set();
        master.forEach(m => {
          if (m.mediserv_item_code) masterCodes.add(m.mediserv_item_code.trim().toLowerCase());
          if (m.manufacturer_item_code) masterCodes.add(m.manufacturer_item_code.trim().toLowerCase());
        });
        const filteredUnknown = unknown.filter(u => !masterCodes.has((u.item_code || '').trim().toLowerCase()));
        setUnknownItems(filteredUnknown);
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
    <div className="p-4 sm:p-6 space-y-6 w-full max-w-[1600px]">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <PackageSearch className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Part List</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all parts and classify unknown items from PDF reports</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Select Vendor</label>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {vendors.map(v => {
            const isActive = selectedVendor === v.id;
            const color = v.color || '#1E3A5F';
            return (
              <button
                key={v.id}
                onClick={() => setSelectedVendor(v.id)}
                className={`relative shrink-0 w-56 text-right p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
                }`}
              >
                {isActive && (
                  <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: color + '20' }}>
                  <Building2 className="w-5 h-5" style={{ color }} />
                </div>
                <p className="text-sm font-semibold truncate">{v.name}</p>
                {v.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{v.description}</p>
                )}
                {v.manufacturer_code && (
                  <p className="text-xs font-mono text-muted-foreground mt-1">{v.manufacturer_code}</p>
                )}
              </button>
            );
          })}
          {vendors.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No vendors yet. Add vendors first.</p>
          )}
        </div>
      </div>

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
            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
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
                  <div className="flex justify-end mb-3">
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

      <MasterItemDialog
        open={addPartOpen}
        onOpenChange={setAddPartOpen}
        vendorId={selectedVendor}
        currency={fileCurrency}
        onSaved={() => {
          fetchAll(base44.entities.MasterItem, { vendor_id: selectedVendor }).then(setMasterItems);
        }}
      />
    </div>
  );
}