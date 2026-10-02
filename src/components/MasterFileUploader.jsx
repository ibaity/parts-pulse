import { useState } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/fetchAll';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { CURRENCIES } from '@/lib/partConstants';

const REQUIRED_FIELDS = [
  { key: 'mediserv_item_code', label: 'Mediserv Item Code' },
  { key: 'manufacturer_item_code', label: 'Manufacturer Item Code' },
  { key: 'description', label: 'Description' },
  { key: 'minimum_stock', label: 'Minimum Stock' },
];

const OPTIONAL_FIELDS = [
  { key: 'unit_price', label: 'Unit Price' },
  { key: 'category', label: 'Category' },
  { key: 'unit', label: 'Unit' },
];

const CHUNK_SIZE = 500;

export default function MasterFileUploader({ vendorId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState({});
  const [currency, setCurrency] = useState('SAR');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const reset = () => {
    setFile(null);
    setColumns([]);
    setRows([]);
    setFileName('');
    setMapping({});
  };

  const handleFile = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setProcessing(true);
    reset();
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (parsed.length === 0) {
        toast({ title: 'Error', description: 'No data found in file', variant: 'destructive' });
        setProcessing(false);
        return;
      }
      const cols = Object.keys(parsed[0]);
      setFile(selectedFile);
      setColumns(cols);
      setRows(parsed);
      setFileName(selectedFile.name);
      const auto = {};
      for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
        const match = cols.find(c => c.toLowerCase().includes(field.key.split('_')[0]));
        if (match) auto[field.key] = match;
      }
      setMapping(auto);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to parse Excel file', variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleSave = async () => {
    if (!mapping.minimum_stock || !mapping.description) {
      toast({ title: 'Warning', description: 'Please map Description and Minimum Stock columns', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const masterFile = await base44.entities.MasterFile.create({
        vendor_id: vendorId,
        file_url,
        file_name: fileName,
        currency,
        column_mapping: mapping,
        item_count: rows.length,
      });

      const existingItems = await fetchAll(base44.entities.MasterItem, { vendor_id: vendorId });
      const normalize = (s) => (s || '').toLowerCase().trim();
      const lookup = new Map();
      existingItems.forEach(item => {
        if (item.mediserv_item_code) lookup.set(normalize(item.mediserv_item_code), item);
        if (item.manufacturer_item_code) lookup.set(normalize(item.manufacturer_item_code), item);
      });

      const toCreate = [];
      const toUpdate = [];
      let mergedCount = 0;
      let newCount = 0;

      rows.forEach(row => {
        const mediservCode = mapping.mediserv_item_code ? String(row[mapping.mediserv_item_code] ?? '') : '';
        const manufacturerCode = mapping.manufacturer_item_code ? String(row[mapping.manufacturer_item_code] ?? '') : '';
        const desc = mapping.description ? String(row[mapping.description] ?? '') : '';
        const minStock = mapping.minimum_stock ? Number(row[mapping.minimum_stock]) || 0 : 0;
        const price = mapping.unit_price ? Number(row[mapping.unit_price]) || 0 : 0;
        const category = mapping.category ? String(row[mapping.category] ?? '') : '';
        const unit = mapping.unit ? String(row[mapping.unit] ?? '') : '';

        const existing = (mediservCode && lookup.get(normalize(mediservCode))) || (manufacturerCode && lookup.get(normalize(manufacturerCode)));

        if (existing) {
          toUpdate.push({
            id: existing.id,
            master_file_id: masterFile.id,
            mediserv_item_code: existing.mediserv_item_code || mediservCode,
            manufacturer_item_code: existing.manufacturer_item_code || manufacturerCode,
            description: existing.description || desc,
            minimum_stock: existing.minimum_stock || minStock,
            unit_price: existing.unit_price || price,
            category: existing.category || category,
            unit: existing.unit || unit,
          });
          mergedCount++;
        } else {
          toCreate.push({
            master_file_id: masterFile.id,
            vendor_id: vendorId,
            mediserv_item_code: mediservCode,
            manufacturer_item_code: manufacturerCode,
            description: desc,
            minimum_stock: minStock,
            unit_price: price,
            category,
            unit,
          });
          newCount++;
        }
      });

      for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
        await base44.entities.MasterItem.bulkCreate(toCreate.slice(i, i + CHUNK_SIZE));
      }
      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        await base44.entities.MasterItem.bulkUpdate(toUpdate.slice(i, i + CHUNK_SIZE));
      }

      toast({ title: 'Success', description: `${newCount} new items added · ${mergedCount} existing items updated` });
      reset();
      onUploaded();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save master file', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!columns.length) {
    return (
      <Card className="p-8 border-2 border-dashed border-border">
        <label className="flex flex-col items-center gap-3 cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            {processing ? (
              <div className="w-6 h-6 border-2 border-muted border-t-accent rounded-full animate-spin" />
            ) : (
              <Upload className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              {processing ? 'Parsing Excel...' : 'Click to upload Master Excel file'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls</p>
          </div>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} disabled={processing} />
        </label>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-success" />
        <span className="text-sm font-medium">{fileName}</span>
        <span className="text-xs text-muted-foreground">({rows.length} rows)</span>
      </div>

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-1">Approved Currency</h4>
        <p className="text-xs text-muted-foreground mb-3">Select the currency used for all prices in this list.</p>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="h-9 w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(c => (
              <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-1">Map Columns</h4>
        <p className="text-xs text-muted-foreground mb-4">Match each field to the corresponding column in your Excel file.</p>
        <div className="grid grid-cols-2 gap-4">
          {REQUIRED_FIELDS.map(field => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-xs font-medium">{field.label}</label>
              <Select
                value={mapping[field.key] || ''}
                onValueChange={v => setMapping({ ...mapping, [field.key]: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {OPTIONAL_FIELDS.map(field => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-xs font-medium">{field.label} <span className="text-muted-foreground">(optional)</span></label>
              <Select
                value={mapping[field.key] || '_none'}
                onValueChange={v => setMapping({ ...mapping, [field.key]: v === '_none' ? '' : v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {columns.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold mb-3">Preview (first 5 rows)</h4>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b">
                {columns.map(col => (
                  <th key={col} className="text-left p-2 font-medium whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, i) => (
                <tr key={i} className="border-b">
                  {columns.map(col => (
                    <td key={col} className="p-2 whitespace-nowrap max-w-[200px] truncate">{String(row[col] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={reset} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Master File'}
        </Button>
      </div>
    </div>
  );
}