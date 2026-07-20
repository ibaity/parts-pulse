import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MasterItemsTable from '@/components/MasterItemsTable';
import UnknownItemsTable from '@/components/UnknownItemsTable';
import { PackageSearch, AlertCircle } from 'lucide-react';

const TABS = [
  { key: 'master', label: 'Master Items', icon: PackageSearch },
  { key: 'unknown', label: 'Unknown Items', icon: AlertCircle },
];

export default function PartList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(searchParams.get('vendor') || '');
  const [masterItems, setMasterItems] = useState([]);
  const [unknownItems, setUnknownItems] = useState([]);
  const [fileCurrency, setFileCurrency] = useState('SAR');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('master');

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
      Promise.all([
        base44.entities.MasterItem.filter({ vendor_id: selectedVendor }, '-created_date', 500),
        base44.entities.AnalysisItem.filter({ vendor_id: selectedVendor, matched_via: 'none' }, '-created_date', 500),
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
    } else {
      setMasterItems([]);
      setUnknownItems([]);
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
                  {masterItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No master items yet. Upload a master file first.</p>
                  ) : (
                    <MasterItemsTable
                      items={masterItems}
                      currency={fileCurrency}
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
    </div>
  );
}