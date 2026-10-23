import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, FileSpreadsheet, Loader2, X, Play, CheckCircle2 } from 'lucide-react';
import { executeAnalysisFlow } from '@/lib/analysisFlow';
import { REPORT_FIELDS, detectColumns, isSpreadsheet, readSheet, rowsToReportItems } from '@/lib/reportParser';
import { parsePdfReport, parseTxtReport } from '@/lib/pdfReport';
import { useVendors } from '@/hooks/useVendors';
import ReportPreview from '@/components/ReportPreview';

const isTxt = (name) => /\.txt$/i.test(name || '');

const ACCEPT = '.pdf,.xlsx,.xls,.csv,.txt';
const NONE = '__none__';

export default function AnalysisRunner({ vendorId, onAnalysisComplete }) {
  const [file, setFile] = useState(null);
  const [sheet, setSheet] = useState(null); // { rows, columns } for Excel/CSV
  // TXT/PDF read in the browser: { items, meta } in the company report layout, or { invalid: true } when not.
  const [report, setReport] = useState(null);
  const [reading, setReading] = useState(false);
  const [mapping, setMapping] = useState({});
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState('');
  const inputRef = useRef(null);
  const { toast } = useToast();
  const { vendors } = useVendors();
  const vendor = vendors.find(v => v.id === vendorId);

  const reset = () => {
    setFile(null);
    setSheet(null);
    setReport(null);
    setMapping({});
    if (inputRef.current) inputRef.current.value = '';
  };

  const selectFile = async (f) => {
    if (!f) return;
    if (!/\.(pdf|xlsx|xls|csv|txt)$/i.test(f.name)) {
      toast({ title: 'Unsupported file', description: 'Upload a PDF, Excel, CSV or TXT report.', variant: 'destructive' });
      return;
    }
    setFile(f);
    setSheet(null);
    setReport(null);
    setMapping({});
    if (isSpreadsheet(f.name)) {
      try {
        const parsed = readSheet(await f.arrayBuffer());
        if (parsed.rows.length === 0) throw new Error('empty');
        setSheet(parsed);
        setMapping(detectColumns(parsed.columns));
      } catch {
        toast({ title: 'Error', description: 'Could not read this file. Check that it has a header row.', variant: 'destructive' });
        reset();
      }
    } else {
      setReading(true);
      try {
        const parsed = isTxt(f.name) ? parseTxtReport(await f.text()) : await parsePdfReport(await f.arrayBuffer());
        setReport(parsed || { invalid: true });
      } catch {
        if (isTxt(f.name)) {
          toast({ title: 'Error', description: 'Could not read this TXT file.', variant: 'destructive' });
          reset();
        } else {
          setReport({ invalid: true });
        }
      }
      setReading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files?.[0]);
  };

  const mappingReady = !sheet || (mapping.item_code && mapping.quantity);
  // A TXT report must have the company layout; any other PDF is still read by AI.
  const txtInvalid = !!file && isTxt(file.name) && !!report?.invalid;
  const reportReady = !reading && !txtInvalid;
  const reportItems = sheet
    ? (mappingReady ? rowsToReportItems(sheet.rows, mapping) : null)
    : report?.items || null;

  const handleAnalyze = async () => {
    if (!file || !mappingReady || !reportReady) return;
    setProcessing(true);
    try {
      // The file is stored so the run can be re-run later. A TXT is already read, so it is analyzed
      // even if storing it fails (only Re-run is then unavailable).
      setStep('Uploading report...');
      let fileUrl = '';
      try {
        fileUrl = (await base44.integrations.Core.UploadFile({ file })).file_url;
      } catch (err) {
        if (!isTxt(file.name)) throw err;
        console.warn('Could not store the TXT report', err);
      }

      const { results, summary, enabledWarehouseCount, newEngineerWarehouses } = await executeAnalysisFlow({
        vendorId,
        pdfFileUrl: fileUrl,
        pdfFileName: file.name,
        reportItems: reportItems || undefined,
        reportMeta: report?.meta,
        onStep: setStep,
      });

      if (enabledWarehouseCount === 0) {
        toast({
          title: 'Warning',
          description: 'No enabled warehouses. All stock will be calculated as 0. Define warehouses in the Warehouses page.',
        });
      }

      toast({
        title: 'Analysis Complete',
        description: `${summary.total_items} items · ${summary.items_to_purchase} to purchase · ${summary.unknown_items} unknown`
          + (newEngineerWarehouses > 0
            ? ` · ${newEngineerWarehouses} new engineer warehouse${newEngineerWarehouses > 1 ? 's' : ''} added as not counted (see Warehouses)`
            : ''),
      });

      onAnalysisComplete(results);
      reset();
    } catch (err) {
      toast({
        title: 'Analysis Failed',
        description: err.message || 'An error occurred during analysis',
        variant: 'destructive',
      });
    }
    setProcessing(false);
    setStep('');
  };

  if (processing) {
    return (
      <Card className="p-10 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-9 h-9 text-accent animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold">Analyzing {file?.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{step}</p>
          </div>
        </div>
      </Card>
    );
  }

  const FileIcon = file && isSpreadsheet(file.name) ? FileSpreadsheet : FileText;

  return (
    <Card className="p-5 shadow-sm space-y-4">
      {!file ? (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/60 hover:bg-muted/40'
          }`}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => selectFile(e.target.files?.[0])} />
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-accent" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">Drop the stock report here, or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">
              TXT or PDF from the company system, or Excel / CSV — read directly, every row
            </p>
          </div>
        </label>
      ) : (
        <>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/60">
            <FileIcon className={`w-5 h-5 shrink-0 ${sheet || report?.items ? 'text-success' : 'text-critical'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className={`text-xs ${txtInvalid ? 'text-critical' : 'text-muted-foreground'}`}>
                {sheet
                  ? `${sheet.rows.length.toLocaleString()} rows detected`
                  : reading
                    ? 'Reading report...'
                    : report?.items
                      ? 'MEDISERV stock report — read directly'
                      : txtInvalid
                        ? 'This TXT file is not in the MEDISERV stock report layout (Item | Description | Inv.Unit | On hand | Lot | Expiry | Warehouse).'
                        : 'Unknown PDF layout — data will be extracted by AI (slower, may miss rows)'}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={reset} aria-label="Remove file">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {sheet && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Match the report columns</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {REPORT_FIELDS.map(field => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-xs font-medium flex items-center gap-1">
                      {field.label}
                      {field.required && <span className="text-critical">*</span>}
                      {mapping[field.key] && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                    </label>
                    <Select
                      value={mapping[field.key] || NONE}
                      onValueChange={(v) => setMapping(prev => ({ ...prev, [field.key]: v === NONE ? undefined : v }))}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select column" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— None —</SelectItem>
                        {sheet.columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportItems && reportItems.length > 0 && (
            <ReportPreview items={reportItems} meta={report?.meta} vendor={vendor} />
          )}

          <div className="flex justify-end">
            <Button onClick={handleAnalyze} disabled={!mappingReady || !reportReady} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Play className="w-4 h-4 mr-2" />Run Analysis
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}