import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { runAnalysis } from '@/lib/analysisUtils';

const CHUNK_SIZE = 500;

export default function AnalysisRunner({ vendorId, onAnalysisComplete }) {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState('');
  const { toast } = useToast();

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setProcessing(true);
    try {
      setStep('Uploading PDF...');
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setStep('Creating analysis run...');
      const run = await base44.entities.AnalysisRun.create({
        vendor_id: vendorId,
        pdf_file_url: file_url,
        pdf_file_name: file.name,
        status: 'processing',
      });

      setStep('Extracting data from PDF (this may take a moment)...');
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item_code: { type: 'string', description: 'The item/product code or SKU number' },
                  warehouse: { type: 'string', description: 'The warehouse name or identifier where the item is stored' },
                  quantity: { type: 'number', description: 'The quantity on hand for this item in this warehouse' },
                },
              },
            },
          },
        },
      });

      if (extractResult.status === 'error') {
        throw new Error(extractResult.details || 'PDF extraction failed');
      }

      const pdfItems = Array.isArray(extractResult.output)
        ? extractResult.output
        : extractResult.output?.items || [];

      if (pdfItems.length === 0) {
        throw new Error('No items found in PDF. Make sure the PDF contains item codes and quantities.');
      }

      setStep('Loading master items...');
      const masterItems = await base44.entities.MasterItem.filter({ vendor_id: vendorId });

      setStep('Loading warehouses...');
      const warehouses = await base44.entities.Warehouse.list('-created_date', 200);
      const enabledWarehouses = warehouses.filter(w => w.enabled);

      if (enabledWarehouses.length === 0) {
        toast({
          title: 'Warning',
          description: 'No enabled warehouses. All stock will be calculated as 0. Define warehouses in the Warehouses page.',
        });
      }

      setStep('Running analysis...');
      const { results, summary } = runAnalysis(pdfItems, masterItems, enabledWarehouses);

      setStep('Saving results...');
      const itemsToSave = results.map(r => ({
        ...r,
        analysis_run_id: run.id,
        vendor_id: vendorId,
      }));
      for (let i = 0; i < itemsToSave.length; i += CHUNK_SIZE) {
        await base44.entities.AnalysisItem.bulkCreate(itemsToSave.slice(i, i + CHUNK_SIZE));
      }

      await base44.entities.AnalysisRun.update(run.id, {
        status: 'completed',
        total_items: summary.total_items,
        items_to_purchase: summary.items_to_purchase,
        critical_items: summary.critical_items,
        unknown_items: summary.unknown_items,
      });

      toast({
        title: 'Analysis Complete',
        description: `${summary.total_items} items found · ${summary.items_to_purchase} to purchase · ${summary.unknown_items} unknown`,
      });

      onAnalysisComplete(results);
      setFile(null);
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
      <Card className="p-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium">Processing...</p>
            <p className="text-xs text-muted-foreground mt-1">{step}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-2 border-dashed border-slate-300">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Upload className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Upload Inventory PDF Report</p>
          <p className="text-xs text-muted-foreground mt-1">The system will extract item codes, warehouses, and quantities</p>
        </div>
        <label className="cursor-pointer">
          <input type="file" accept=".pdf" className="hidden" onChange={handleFile} />
          <Button variant="outline" asChild>
            <span><FileText className="w-4 h-4 mr-2" />Select PDF</span>
          </Button>
        </label>
        {file && (
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
              <FileText className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
            <Button onClick={handleAnalyze}>Run Analysis</Button>
          </div>
        )}
      </div>
    </Card>
  );
}