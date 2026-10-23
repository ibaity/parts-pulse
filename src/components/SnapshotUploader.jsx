import { useState } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { parsePdfReport, parseTxtReport } from '@/lib/pdfReport';
import { catalogCodeKey, countsTowardStock, splitItemCode } from '@/lib/analysisUtils';
import { useVendors } from '@/hooks/useVendors';
import ReportPreview from '@/components/ReportPreview';

const REQUIRED_FIELDS = [
  { key: 'item_code', label: 'Item Code' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'description', label: 'Description' },
];

const CHUNK_SIZE = 500;

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

const isTxt = (name) => /\.txt$/i.test(name || '');
const isPdf = (name) => /\.pdf$/i.test(name || '');

// The company stock report (TXT/PDF) has a line per lot and warehouse: they become one record per part,
// counting only warehouses that count toward stock (Warehouses page; new engineer stock does not count).
function reportStockRecords(items, warehouses) {
  const byPart = new Map();
  for (const r of items) {
    const code = splitItemCode(r.item_code)[0];
    if (!code) continue;
    const key = catalogCodeKey(code);
    if (!byPart.has(key)) byPart.set(key, { item_code: code, description: r.description || '', quantity: 0 });
    const rec = byPart.get(key);
    if (!rec.description && r.description) rec.description = r.description;
    if (countsTowardStock(r.warehouse, warehouses)) rec.quantity += Number(r.quantity) || 0;
  }
  return [...byPart.values()];
}

export default function SnapshotUploader({ vendorId, onUploaded }) {
  const [snapshotDate, setSnapshotDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState({});
  const [report, setReport] = useState(null); // { items, meta } for a TXT/PDF company report
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { vendors } = useVendors();
  const vendor = vendors.find(v => v.id === vendorId);

  const reset = () => {
    setFile(null);
    setColumns([]);
    setRows([]);
    setReport(null);
    setFileName('');
    setMapping({});
    setNotes('');
    setSnapshotDate(todayStr());
  };

  const handleFile = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setProcessing(true);
    reset();
    setSnapshotDate(todayStr());
    if (isTxt(selectedFile.name) || isPdf(selectedFile.name)) {
      try {
        const parsed = isTxt(selectedFile.name)
          ? parseTxtReport(await selectedFile.text())
          : await parsePdfReport(await selectedFile.arrayBuffer());
        if (!parsed) {
          toast({ title: 'Error', description: 'This file is not in the MEDISERV stock report layout.', variant: 'destructive' });
        } else {
          setFile(selectedFile);
          setFileName(selectedFile.name);
          setReport(parsed);
          if (parsed.meta?.report_date) setSnapshotDate(parsed.meta.report_date.slice(0, 10));
        }
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to read this file', variant: 'destructive' });
      }
      setProcessing(false);
      e.target.value = '';
      return;
    }
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
      for (const field of REQUIRED_FIELDS) {
        const match = cols.find(c => c.toLowerCase().includes(field.key));
        if (match) auto[field.key] = match;
      }
      setMapping(auto);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to parse Excel file', variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleSave = async () => {
    if (!report && (!mapping.item_code || !mapping.quantity)) {
      toast({ title: 'Warning', description: 'Please map Item Code and Quantity columns', variant: 'destructive' });
      return;
    }
    if (!snapshotDate) {
      toast({ title: 'Warning', description: 'Please select a snapshot date', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.integrations.Core.UploadFile({ file });

      const records = report
        ? reportStockRecords(report.items, await base44.entities.Warehouse.list('-created_date', 200))
        : rows.map(row => ({
          item_code: String(row[mapping.item_code] ?? '').trim(),
          description: mapping.description ? String(row[mapping.description] ?? '') : '',
          quantity: mapping.quantity ? Number(row[mapping.quantity]) || 0 : 0,
        })).filter(i => i.item_code);

      const snapshot = await base44.entities.InventorySnapshot.create({
        vendor_id: vendorId,
        snapshot_date: snapshotDate,
        file_name: fileName,
        notes,
        item_count: records.length,
      });

      const items = records.map(r => ({ ...r, snapshot_id: snapshot.id, vendor_id: vendorId }));

      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        await base44.entities.StockRecord.bulkCreate(items.slice(i, i + CHUNK_SIZE));
      }

      toast({ title: 'Success', description: `${items.length} stock records saved` });
      reset();
      onUploaded();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save snapshot', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!columns.length && !report) {
    return (
      <Card className="p-8 border-2 border-dashed border-border">
        <div className="space-y-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Snapshot Date</Label>
              <Input type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Notes (optional)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Quarterly count" className="h-9" />
            </div>
          </div>
        </div>
        <label className="flex flex-col items-center gap-3 cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            {processing ? (
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              {processing ? 'Reading file...' : 'Click to upload stock inventory file'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Supports the company stock report (.txt, .pdf) and .xlsx, .xls, .csv</p>
          </div>
          <input type="file" accept=".txt,.pdf,.xlsx,.xls,.csv" className="hidden" onChange={handleFile} disabled={processing} />
        </label>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {report ? <FileText className="w-5 h-5 text-success" /> : <FileSpreadsheet className="w-5 h-5 text-success" />}
        <span className="text-sm font-medium">{fileName}</span>
        <span className="text-xs text-muted-foreground">({(report ? report.items.length : rows.length).toLocaleString()} rows)</span>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Snapshot Date</Label>
            <Input type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Quarterly count" className="h-9" />
          </div>
        </div>
        {report ? (
          <div className="space-y-2">
            <ReportPreview items={report.items} meta={report.meta} vendor={vendor} />
            <p className="text-xs text-muted-foreground">
              Lots and warehouses are added up per part. Only warehouses that count toward stock are included
              (Warehouses page); engineer stock not defined yet is left out.
            </p>
          </div>
        ) : (
          <>
          <h4 className="text-sm font-semibold mb-1">Map Columns</h4>
          <p className="text-xs text-muted-foreground mb-4">Match each field to the corresponding column in your Excel file.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </div>
          </>
        )}
      </Card>

      {report ? (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">Preview (first 5 rows)</h4>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b">
                  {['Item', 'Description', 'On hand', 'Warehouse'].map(col => (
                    <th key={col} className="text-left p-2 font-medium whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.items.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2 whitespace-nowrap font-mono">{r.item_code}</td>
                    <td className="p-2 whitespace-nowrap max-w-[200px] truncate">{r.description}</td>
                    <td className="p-2 whitespace-nowrap">{r.quantity}</td>
                    <td className="p-2 whitespace-nowrap">{[r.warehouse, r.warehouse_name].filter(Boolean).join(' - ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
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
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={reset} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {saving ? 'Saving...' : 'Save Snapshot'}
        </Button>
      </div>
    </div>
  );
}