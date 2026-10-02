import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AnalysisRunner from '@/components/AnalysisRunner';
import ResultsTable from '@/components/ResultsTable';
import ManualOrderPanel from '@/components/ManualOrderPanel';
import { executeAnalysisFlow } from '@/lib/analysisFlow';
import { useToast } from '@/components/ui/use-toast';
import { FileText, ChevronRight, RefreshCw, Loader2 } from 'lucide-react';
import moment from 'moment';
import { useVendorSelection } from '@/hooks/useVendors';

export default function Analysis() {
  const { vendors, selectedVendor, setSelectedVendor } = useVendorSelection();
  const [results, setResults] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loadingRun, setLoadingRun] = useState(null);
  const [rerunId, setRerunId] = useState(null);
  const [rerunStep, setRerunStep] = useState('');
  const [fileCurrency, setFileCurrency] = useState('SAR');
  const [manualItems, setManualItems] = useState([]);
  const [activeTab, setActiveTab] = useState('analysis');
  const { toast } = useToast();

  const loadManualItems = async () => {
    if (!selectedVendor) return;
    try {
      const data = await base44.entities.ManualOrderItem.filter({ vendor_id: selectedVendor }, '-created_date', 200);
      setManualItems(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRuns = async () => {
    if (!selectedVendor) return;
    const data = await base44.entities.AnalysisRun.filter({ vendor_id: selectedVendor }, '-created_date', 20);
    setRuns(data);
    if (data.length > 0 && data[0].status === 'completed') {
      try {
        const items = await base44.entities.AnalysisItem.filter({ analysis_run_id: data[0].id }, '-recommended_quantity', 500);
        setResults(items);
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    if (selectedVendor) {
      loadRuns();
      loadManualItems();
      base44.entities.MasterFile.filter({ vendor_id: selectedVendor }, '-created_date', 100)
        .then(files => {
          if (files.length > 0 && files[0].currency) setFileCurrency(files[0].currency);
        })
        .catch(() => {});
    } else {
      setResults(null);
      setManualItems([]);
    }
  }, [selectedVendor]);

  const handleViewRun = async (run) => {
    setLoadingRun(run.id);
    try {
      const items = await base44.entities.AnalysisItem.filter({ analysis_run_id: run.id }, '-recommended_quantity', 500);
      setResults(items);
      setActiveTab('results');
    } catch (err) {
      console.error(err);
    }
    setLoadingRun(null);
  };

  const handleAnalysisComplete = (newResults) => {
    setResults(newResults);
    loadRuns();
    setActiveTab('results');
  };

  const handleRerun = async (run) => {
    setRerunId(run.id);
    setRerunStep('');
    try {
      const { results: newResults, summary, enabledWarehouseCount } = await executeAnalysisFlow({
        vendorId: selectedVendor,
        pdfFileUrl: run.pdf_file_url,
        pdfFileName: run.pdf_file_name,
        onStep: setRerunStep,
      });

      if (enabledWarehouseCount === 0) {
        toast({
          title: 'Warning',
          description: 'No enabled warehouses. All stock will be calculated as 0. Define warehouses in the Warehouses page.',
        });
      }

      toast({
        title: 'Re-analysis Complete',
        description: `${summary.total_items} items found · ${summary.items_to_purchase} to purchase · ${summary.unknown_items} unknown`,
      });

      setResults(newResults);
      loadRuns();
    } catch (err) {
      toast({
        title: 'Re-analysis Failed',
        description: err.message || 'An error occurred during re-analysis',
        variant: 'destructive',
      });
    }
    setRerunId(null);
    setRerunStep('');
  };

  const selectedVendorObj = vendors.find(v => v.id === selectedVendor);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload a PDF inventory report and get purchase recommendations</p>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="results">
              Purchase Recommendations
              {results && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({results.filter(r => r.status !== 'unknown').length + manualItems.length})
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-6 mt-4">
            <AnalysisRunner
              vendorId={selectedVendor}
              onAnalysisComplete={handleAnalysisComplete}
            />

            <ManualOrderPanel
              vendorId={selectedVendor}
              currency={fileCurrency}
              items={manualItems}
              onAdded={loadManualItems}
              onDeleted={(id) => setManualItems(prev => prev.filter(i => i.id !== id))}
              onUpdated={loadManualItems}
            />

          {runs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Past Analysis Runs</h2>
              <div className="space-y-2">
                {runs.map(run => (
                  <Card key={run.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-red-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{run.pdf_file_name}</p>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {moment(run.created_date).format('MMM D, YYYY HH:mm')}
                            <span className="text-amber-600 ml-2">{run.items_to_purchase || 0} to purchase</span>
                            <span className="text-red-600 ml-2">{run.critical_items || 0} critical</span>
                            <span className="text-purple-600 ml-2">{run.unknown_items || 0} unknown</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {rerunId === run.id && (
                          <span className="text-xs text-muted-foreground hidden sm:inline max-w-[200px] truncate">
                            {rerunStep}
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRerun(run)}
                          disabled={rerunId === run.id || rerunId !== null}
                          className="shrink-0"
                        >
                          {rerunId === run.id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          Re-run
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewRun(run)}
                          disabled={loadingRun === run.id}
                          className="shrink-0"
                        >
                          {loadingRun === run.id ? 'Loading...' : 'View Results'}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          </TabsContent>

          <TabsContent value="results" className="mt-4">
            {results ? (
              <ResultsTable
                results={results}
                vendorName={selectedVendorObj?.name}
                currency={fileCurrency}
                manualItems={manualItems}
              />
            ) : (
              <Card className="p-8 text-center text-muted-foreground">
                <p className="text-sm">No results yet. Run an analysis first.</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}