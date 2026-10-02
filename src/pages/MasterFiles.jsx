import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/fetchAll';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import MasterFileUploader from '@/components/MasterFileUploader';
import { FileSpreadsheet, ArrowRight, Download } from 'lucide-react';
import moment from 'moment';
import { useVendorSelection } from '@/hooks/useVendors';

export default function MasterFiles() {
  const { vendors, selectedVendor, setSelectedVendor } = useVendorSelection();
  const [masterFiles, setMasterFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const loadMasterFiles = async () => {
    if (!selectedVendor) return;
    setLoading(true);
    try {
      const data = await base44.entities.MasterFile.filter({ vendor_id: selectedVendor }, '-created_date', 50);
      setMasterFiles(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedVendor) {
      loadMasterFiles();
    }
  }, [selectedVendor]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const items = await fetchAll(base44.entities.MasterItem, { vendor_id: selectedVendor });
      const data = items.map(item => ({
        'Mediserv Item Code': item.mediserv_item_code || '',
        'Manufacturer Item Code': item.manufacturer_item_code || '',
        'Description': item.description || '',
        'Minimum Stock': item.minimum_stock || 0,
        'Unit Price': item.unit_price || 0,
        'Category': item.category || '',
        'Unit': item.unit || '',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Master Items');
      const vendorName = vendors.find(v => v.id === selectedVendor)?.name || 'vendor';
      XLSX.writeFile(wb, `master-items-${vendorName}-${moment().format('YYYYMMDD')}.xlsx`);
      toast({ title: 'Exported', description: `${items.length} items exported` });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to export data', variant: 'destructive' });
    }
    setExporting(false);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Master Files</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload vendor master Excel files and map columns manually</p>
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
        <>
          <div>
            <h2 className="text-lg font-semibold mb-3">Upload New Master File</h2>
            <MasterFileUploader vendorId={selectedVendor} onUploaded={loadMasterFiles} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Existing Master Files</h2>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || loading}>
                {exporting && <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin mr-1" />}
                <Download className="w-4 h-4 mr-1" />
                {exporting ? 'Exporting...' : 'Export All Items'}
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
              </div>
            ) : masterFiles.length === 0 ? (
              <Card className="p-12 text-center">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">No master files uploaded yet</p>
                <p className="text-xs text-muted-foreground mt-1">Upload an Excel file above to get started.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {masterFiles.map(mf => (
                  <Card key={mf.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{mf.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {mf.item_count || 0} items · {moment(mf.created_date).format('MMM D, YYYY HH:mm')}
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/part-list?vendor=${selectedVendor}`}>
                        Manage in Part List <ArrowRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}