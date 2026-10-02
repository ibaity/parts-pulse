import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, FileSpreadsheet, Loader2, X, Play, CheckCircle2 } from 'lucide-react';
import { executeAnalysisFlow } from '@/lib/analysisFlow';
import { REPORT_FIELDS, detectColumns, isSpreadsheet, readSheet, rowsToReportItems } from '@/lib/reportParser';

const ACCEPT = '.pdf,.xlsx,.xls,.csv';
const NONE = '__none__';

export default function AnalysisRunner({ vendorId, onAnalysisComplete }) {
  const [file, setFile] = useState(null);
  const [sheet, setSheet] = useState(null); // { rows, columns } for Excel/CSV
  const [mapping, setMapping] = useState({});
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState('');
  const inputRef = useRef(null);
  const { toast } = useToast();

  const reset = () => {
    setFile(null);
    setSheet(null);
    setMapping({});
    if (inputRef.current) inputRef.current.value = '';
  };

  const selectFile = async (f) => {
    if (!f) return;
    if (!/\.(pdf|xlsx|xls|csv)$/i.test(f.name)) {
      toast({ title: 'Unsupported file', description: 'Upload a PDF, Excel or CSV report.', variant: 'destructive' });
      return;
    }
    setFile(f);
    setSheet(null);
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
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files?.[0]);
  };

  const mappingReady = !sheet || (mapping.item_code && mapping.quantity);

  const handleAnalyze = async () => {
    if (!file || !mappingReady) return;
    setProcessing(true);
    try {
      setStep('Uploading report...');
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const { results, summary, enabledWarehouseCount } = await executeAnalysisFlow({
        vendorId,
        pdfFileUrl: file_url,
        pdfFileName: file.name,
        reportItems: sheet ? rowsToReportItems(sheet.rows, mapping) : undefined,
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
        description: `${summary.total_items} items · ${summary.items_to_purchase} to purchase · ${summary.unknown_items} unknown`,
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
              Excel / CSV (fast &amp; exact) or PDF (read by AI, slower)
            </p>
          </div>
        </label>
      ) : (
        <>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/60">
            <FileIcon className={`w-5 h-5 shrink-0 ${sheet ? 'text-success' : 'text-critical'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {sheet ? `${sheet.rows.length.toLocaleString()} rows detected` : 'PDF — data will be extracted by AI'}
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

          <div className="flex justify-end">
            <Button onClick={handleAnalyze} disabled={!mappingReady} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Play className="w-4 h-4 mr-2" />Run Analysis
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
