import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MasterItemsTable from '@/components/MasterItemsTable';
import UnknownItemsTable from '@/components/UnknownItemsTable';
import { PackageSearch, AlertCircle } from 'lucide-react';

export default function PartList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(searchParams.get('vendor') || '');
  const [masterItems, setMasterItems] = useState([]);
  const [unknownItems, setUnknownItems] = useState([]);
  const [loading, setLoading] = useState(false);

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
      ]).then(([master, unknown]) => {
        setMasterItems(master);
        setUnknownItems(unknown);
      }).catch(err => console.error(err)).finally(() => setLoading(false));
    } else {
      setMasterItems([]);
      setUnknownItems([]);
    }
  }, [selectedVendor]);

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Part List</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage all parts and classify unknown items from PDF reports</p>
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
            {unknownItems.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <h2 className="text-lg font-semibold">Unknown Items ({unknownItems.length})</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Items from PDF reports not matched in the master list — classify and save them to the master.</p>
                <UnknownItemsTable
                  items={unknownItems}
                  vendorId={selectedVendor}
                  onSaved={(id) => {
                    setUnknownItems(prev => prev.filter(i => i.id !== id));
                    setMasterItems(prev => [...prev]);
                  }}
                />
              </Card>
            )}

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <PackageSearch className="w-5 h-5 text-primary shrink-0" />
                <h2 className="text-lg font-semibold">Master Items ({masterItems.length})</h2>
              </div>
              {masterItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No master items yet. Upload a master file first.</p>
              ) : (
                <MasterItemsTable items={masterItems} onDeleted={(id) => setMasterItems(prev => prev.filter(i => i.id !== id))} />
              )}
            </Card>
          </>
        )
      )}
    </div>
  );
}