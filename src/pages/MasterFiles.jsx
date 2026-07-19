import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MasterFileUploader from '@/components/MasterFileUploader';
import MasterItemsTable from '@/components/MasterItemsTable';
import { FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react';
import moment from 'moment';

export default function MasterFiles() {
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [masterFiles, setMasterFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFile, setExpandedFile] = useState(null);
  const [fileItems, setFileItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.Vendor.list('-created_date', 100);
        setVendors(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    load();
  }, []);

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
      setExpandedFile(null);
      loadMasterFiles();
    }
  }, [selectedVendor]);

  const handleViewItems = async (fileId) => {
    if (expandedFile === fileId) {
      setExpandedFile(null);
      return;
    }
    setExpandedFile(fileId);
    setLoadingItems(true);
    try {
      const items = await base44.entities.MasterItem.filter({ master_file_id: fileId }, '-created_date', 500);
      setFileItems(items);
    } catch (err) {
      console.error(err);
    }
    setLoadingItems(false);
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl">
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
            <h2 className="text-lg font-semibold mb-3">Existing Master Files</h2>
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
                  <Card key={mf.id} className="overflow-hidden">
                    <button
                      onClick={() => handleViewItems(mf.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
                        <div className="text-left">
                          <p className="font-medium text-sm">{mf.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {mf.item_count || 0} items · {moment(mf.created_date).format('MMM D, YYYY HH:mm')}
                          </p>
                        </div>
                      </div>
                      {expandedFile === mf.id ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                    </button>
                    {expandedFile === mf.id && (
                      <div className="border-t bg-slate-50/50">
                        {loadingItems ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                          </div>
                        ) : (
                          <div className="p-3">
                            <MasterItemsTable items={fileItems} fileId={expandedFile} />
                          </div>
                        )}
                      </div>
                    )}
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