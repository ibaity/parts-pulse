import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { executeAnalysisFlow } from '@/lib/analysisFlow';

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

      const { results, summary, enabledWarehouseCount } = await executeAnalysisFlow({
        vendorId,
        pdfFileUrl: file_url,
        pdfFileName: file.name,
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