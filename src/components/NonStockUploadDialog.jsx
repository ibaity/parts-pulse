import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileSpreadsheet, Loader2, AlertTriangle } from 'lucide-react';
import { readSheet } from '@/lib/reportParser';
import { fetchAll } from '@/lib/fetchAll';
import { useVendorSelection } from '@/hooks/useVendors';
import {
  NON_STOCK_FIELDS, NON_STOCK_LOCATIONS, detectNonStockColumns, rowsToNonStockItems, planReplace, locationLabel, locationOf,
  hasLocationColumns, uploadLocations, vendorFromFileName,
} from '@/lib/nonStock';

const NONE = '__none';
const CHUNK_SIZE = 500;

export default function NonStockUploadDialog({ open, onClose, onSaved, existingItems, defaultLocation }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [fallback, setFallback] = useState(defaultLocation || NONE);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { vendors, selectedVendor } = useVendorSelection();
  const [vendorId, setVendorId] = useState(NONE);
  const { toast } = useToast();
  const vendorKey = vendorId === NONE ? '' : vendorId;

  const reset = () => {
    setFileName(''); setRows([]); setColumns([]); setMapping({}); setFallback(defaultLocation || NONE); setVendorId(NONE);
  };

  const close = () => { if (!saving) { reset(); onClose(); } };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReading(true);
    try {
      const sheet = readSheet(await file.arrayBuffer());
      if (!sheet.rows.length) {
        toast({ title: 'Error', description: 'No data found in file', variant: 'destructive' });
      } else {
        setFileName(file.name);
        setRows(sheet.rows);
        setColumns(sheet.columns);
        setMapping(detectNonStockColumns(sheet.columns));
        setVendorId(vendorFromFileName(file.name, vendors) || selectedVendor || NONE);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to read this Excel file', variant: 'destructive' });
    }
    setReading(false);
  };

  const wide = hasLocationColumns(mapping);
  const result = useMemo(
    () => (mapping.item_code && (wide || mapping.quantity) ? rowsToNonStockItems(rows, mapping, fallback === NONE ? '' : fallback) : null),
    [rows, mapping, fallback, wide]
  );
  const locations = useMemo(() => (result ? uploadLocations(mapping, result.items) : []), [mapping, result]);

  const summary = useMemo(() => {
    if (!result) return [];
    return NON_STOCK_LOCATIONS.filter(l => locations.includes(l.code)).map(l => {
      const incoming = result.items.filter(i => i.location_code === l.code);
      const replaced = existingItems.filter(i => i.status !== 'used' && (i.vendor_id || '') === vendorKey && locationOf(i) === l.code).length;
      return { code: l.code, items: incoming.length, quantity: incoming.reduce((s, i) => s + i.quantity, 0), replaced };
    });
  }, [result, locations, existingItems, vendorKey]);

  const handleSave = async () => {
    if (!result || !locations.length) return;
    setSaving(true);
    try {
      // Read fresh so items added since the page loaded are replaced too.
      const existing = await fetchAll(base44.entities.NonStockItem);
      const plan = planReplace(existing, result.items, { vendorId: vendorKey, locations });
      // New stock is saved before the old is removed, so a failed upload never leaves a location empty.
      for (let i = 0; i < plan.toCreate.length; i += CHUNK_SIZE) {
        await base44.entities.NonStockItem.bulkCreate(plan.toCreate.slice(i, i + CHUNK_SIZE));
      }
      for (let i = 0; i < plan.toDelete.length; i += 20) {
        await Promise.all(plan.toDelete.slice(i, i + 20).map(id => base44.entities.NonStockItem.delete(id)));
      }
      toast({ title: 'Uploaded', description: `${plan.toCreate.length} items saved for ${plan.locations.join(', ')}` });
      reset();
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: 'Upload failed. Reload the page and check the stock before trying again.', variant: 'destructive' });
      onSaved();
    }
    setSaving(false);
  };

  const skipped = result ? result.noLocation + result.emptyQty : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Non-Stock Excel</DialogTitle>
          <DialogDescription>
            The file replaces this vendor's available stock in each location it contains. Items marked as used are kept.
          </DialogDescription>
        </DialogHeader>

        {!fileName ? (
          <label className="flex flex-col items-center gap-3 cursor-pointer border-2 border-dashed rounded-lg p-8">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              {reading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{reading ? 'Reading file...' : 'Click to choose an Excel file'}</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls or .csv with item code and quantity, plus a location column (N102 / N202 / N302) or one location for the whole file</p>
            </div>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} disabled={reading} />
          </label>
        ) : (
          <div className="space-y-4 py-1">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4 text-success" />
              <span className="font-medium truncate">{fileName}</span>
              <span className="text-xs text-muted-foreground">({rows.length.toLocaleString()} rows)</span>
              <Button variant="link" size="sm" className="ml-auto h-auto p-0" onClick={reset} disabled={saving}>Choose another</Button>
            </div>

            {wide && (
              <p className="text-xs text-muted-foreground">
                One quantity column per location: {Object.entries(mapping.locationColumns).map(([code, col]) => `${col} → ${code}`).join(' · ')}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vendor</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— No vendor —</SelectItem>
                    {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {NON_STOCK_FIELDS.filter(f => !wide || (f.key !== 'quantity' && f.key !== 'location')).map(field => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs">{field.label}{field.required ? ' *' : ''}</Label>
                  <Select value={mapping[field.key] || NONE} onValueChange={v => setMapping(m => ({ ...m, [field.key]: v === NONE ? undefined : v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— None —</SelectItem>
                      {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {!wide && <div className="space-y-1.5">
                <Label className="text-xs">{mapping.location ? 'Location for rows without one' : 'Location for this file *'}</Label>
                <Select value={fallback} onValueChange={setFallback}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— None —</SelectItem>
                    {NON_STOCK_LOCATIONS.map(l => <SelectItem key={l.code} value={l.code}>{locationLabel(l.code)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>}
            </div>

            {!result ? (
              <p className="text-xs text-destructive">Choose the Item Code and Quantity columns.</p>
            ) : (
              <div className="space-y-2">
                {summary.length === 0 ? (
                  <p className="text-xs text-destructive">No rows can be saved. Pick a location column or a location for this file.</p>
                ) : (
                  <div className="rounded-md border divide-y text-sm">
                    {summary.map(s => (
                      <div key={s.code} className="flex flex-wrap gap-x-4 gap-y-1 p-2.5">
                        <span className="font-medium">{locationLabel(s.code)}</span>
                        <span className="tabular-nums">{s.items} items · {s.quantity.toLocaleString()} qty</span>
                        <span className="text-muted-foreground sm:ml-auto">replaces {s.replaced} available items</span>
                      </div>
                    ))}
                  </div>
                )}
                {skipped > 0 && (
                  <p className="flex items-start gap-1.5 text-xs text-warning">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      Left out: {result.noLocation > 0 ? `${result.noLocation} rows with no known location` : ''}
                      {result.noLocation > 0 && result.emptyQty > 0 ? ', ' : ''}
                      {result.emptyQty > 0 ? `${result.emptyQty} items with zero quantity` : ''}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !locations.length}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : `Replace stock${result?.items.length ? ` (${result.items.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
