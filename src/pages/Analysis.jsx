import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ResultsTable from '@/components/ResultsTable';
import ManualOrderPanel from '@/components/ManualOrderPanel';
import { fetchAll } from '@/lib/fetchAll';
import { isSpreadsheet } from '@/lib/fileTypes';
import { useToast } from '@/components/ui/use-toast';
import { FileText, FileSpreadsheet, ChevronRight, RefreshCw, Loader2, FlaskConical } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import VendorNotice from '@/components/VendorNotice';
import moment from 'moment';
import { useVendorSelection } from '@/hooks/useVendors';
import { getSarRate } from '@/lib/partConstants';
import { catalogCodeKey, splitItemCode } from '@/lib/analysisUtils';

// The report readers (xlsx, pdf.js) are large: they load only when a new analysis or a re-run needs them,
// so opening the page to look at the stock status stays fast.
const AnalysisRunner = lazy(() => import('@/components/AnalysisRunner'));

// Stock status of an analysis row after its minimum changes (same rule as the analysis itself).
function withMinimum(row, minimum) {
  const current = Number(row.current_stock) || 0;
  const needsPurchase = current < minimum;
  return {
    minimum_stock: minimum,
    recommended_quantity: needsPurchase ? minimum - current : 0,
    status: !needsPurchase ? 'sufficient' : current <= 0 ? 'critical' : 'low',
  };
}

export default function Analysis() {
  const { vendors, selectedVendor } = useVendorSelection();
  const [results, setResults] = useState(null);
  const [shownRun, setShownRun] = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [runs, setRuns] = useState([]);
  const [loadingRun, setLoadingRun] = useState(null);
  const [rerunId, setRerunId] = useState(null);
  const [rerunStep, setRerunStep] = useState('');
  const [fileCurrency, setFileCurrency] = useState('SAR');
  const [sarRate, setSarRate] = useState(1);
  const [manualItems, setManualItems] = useState([]);
  const [activeTab, setActiveTab] = useState('results');
  const { toast } = useToast();
  // Requests started for one vendor must not overwrite the page after switching to another.
  const vendorRef = useRef(selectedVendor);
  vendorRef.current = selectedVendor;
  // Master items of the vendor, read once on the first minimum edit instead of on every edit.
  const masterCache = useRef({ vendorId: null, items: null });

  const loadMasterItems = async () => {
    const vendorId = selectedVendor;
    if (masterCache.current.vendorId !== vendorId || !masterCache.current.items) {
      masterCache.current = { vendorId, items: fetchAll(base44.entities.MasterItem, { vendor_id: vendorId }) };
    }
    try {
      return await masterCache.current.items;
    } catch (err) {
      masterCache.current = { vendorId: null, items: null };
      throw err;
    }
  };

  // Changes the order quantity of one row: an analysis row only for the shown run (a new analysis suggests
  // its own quantity again), a manual row on the manual order list.
  const handleUpdateQuantity = async (row, quantity) => {
    try {
      if (row.source === 'manual') {
        await base44.entities.ManualOrderItem.update(row.manual_id, { quantity });
        setManualItems(prev => prev.map(m => (m.id === row.manual_id ? { ...m, quantity } : m)));
      } else {
        await base44.entities.AnalysisItem.update(row.id, { recommended_quantity: quantity });
        setResults(prev => prev.map(r => (r.id === row.id ? { ...r, recommended_quantity: quantity } : r)));
      }
      return true;
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to update the order quantity', variant: 'destructive' });
      return false;
    }
  };

  // Changes a part's minimum from the Stock Status table: saved on its master item(s), so later analyses use it,
  // and on the shown analysis row, so the purchase list updates right away.
  const handleUpdateMinimum = async (analysisId, minimum) => {
    const row = results?.find(r => r.id === analysisId);
    if (!row) return false;
    try {
      const keys = new Set(splitItemCode(row.item_code).concat(row.item_code).map(catalogCodeKey).filter(Boolean));
      const masterItems = await loadMasterItems();
      // Every master record of the part (e.g. "D0066806" and "IMM0066806") gets the new minimum,
      // otherwise the analysis would keep using the higher one of them.
      const matches = masterItems.filter(mi =>
        keys.has(catalogCodeKey(mi.mediserv_item_code)) || keys.has(catalogCodeKey(mi.manufacturer_item_code)));
      if (matches.length === 0) {
        toast({ title: 'Not in the master list', description: `${row.item_code} was not found in the master list`, variant: 'destructive' });
        return false;
      }
      const changes = withMinimum(row, minimum);
      await Promise.all([
        ...matches.map(mi => base44.entities.MasterItem.update(mi.id, { minimum_stock: minimum })),
        base44.entities.AnalysisItem.update(row.id, changes),
      ]);
      for (const mi of matches) mi.minimum_stock = minimum; // keep the cached copy current
      const updated = results.map(r => (r.id === row.id ? { ...r, ...changes } : r));
      setResults(updated);

      // Keep the run's counts in line with its items.
      if (shownRun) {
        const summary = {
          items_to_purchase: updated.filter(r => r.status === 'critical' || r.status === 'low').length,
          critical_items: updated.filter(r => r.status === 'critical').length,
        };
        setShownRun(prev => (prev ? { ...prev, ...summary } : prev));
        setRuns(prev => prev.map(r => (r.id === shownRun.id ? { ...r, ...summary } : r)));
        base44.entities.AnalysisRun.update(shownRun.id, summary).catch(() => {});
      }

      toast({
        title: 'Minimum updated',
        description: changes.status === 'sufficient'
          ? `${row.item_code}: minimum ${minimum} — stock is enough now, removed from the purchase list`
          : `${row.item_code}: minimum ${minimum} — order ${changes.recommended_quantity}`,
      });
      return true;
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to update the minimum', variant: 'destructive' });
      return false;
    }
  };

  // Deletes from the Stock Status table. Items already deleted stay removed even if others fail.
  const handleDeleteManual = async (ids) => {
    const outcomes = await Promise.allSettled(ids.map(id => base44.entities.ManualOrderItem.delete(id)));
    const deleted = ids.filter((_, i) => outcomes[i].status === 'fulfilled');
    setManualItems(prev => prev.filter(item => !deleted.includes(item.id)));
    const failed = ids.length - deleted.length;
    if (failed > 0) {
      toast({ title: 'Error', description: `${failed} of ${ids.length} items could not be deleted`, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: `${deleted.length} manual ${deleted.length === 1 ? 'item' : 'items'} removed` });
    }
  };

  const loadManualItems = async () => {
    if (!selectedVendor) return;
    try {
      const vendorId = selectedVendor;
      const data = await base44.entities.ManualOrderItem.filter({ vendor_id: vendorId }, '-created_date', 200);
      if (vendorRef.current === vendorId) setManualItems(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Always show the results of the latest completed analysis for the selected vendor.
  const loadRuns = async () => {
    if (!selectedVendor) return;
    const vendorId = selectedVendor;
    setLoadingLatest(true);
    try {
      const data = await base44.entities.AnalysisRun.filter({ vendor_id: vendorId }, '-created_date', 20);
      if (vendorRef.current !== vendorId) return;
      setRuns(data);
      const latest = data.find(r => r.status === 'completed');
      if (latest) {
        const items = await fetchAll(base44.entities.AnalysisItem, { analysis_run_id: latest.id }, '-recommended_quantity');
        if (vendorRef.current !== vendorId) return;
        setResults(items);
        setShownRun(latest);
      } else {
        setResults(null);
        setShownRun(null);
        setActiveTab('analysis');
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (vendorRef.current === vendorId) setLoadingLatest(false);
    }
  };

  useEffect(() => {
    setResults(null);
    setShownRun(null);
    setRuns([]);
    setActiveTab('results');
    if (selectedVendor) {
      loadRuns();
      loadManualItems();
      // Only the newest master file sets the currency.
      base44.entities.MasterFile.filter({ vendor_id: selectedVendor }, '-created_date', 1)
        .then(files => {
          if (vendorRef.current === files[0]?.vendor_id && files[0].currency) {
            setFileCurrency(files[0].currency);
            setSarRate(getSarRate(files[0].currency, files[0].sar_rate));
          }
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
      const items = await fetchAll(base44.entities.AnalysisItem, { analysis_run_id: run.id }, '-recommended_quantity');
      setResults(items);
      setShownRun(run);
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
      const { executeAnalysisFlow } = await import('@/lib/analysisFlow');
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
    <div className="p-4 sm:p-8 space-y-6">
      <PageHeader icon={FlaskConical} title="Analysis" subtitle="Upload the stock report (Excel, CSV or PDF) to get purchase recommendations" />

      <VendorNotice />

      {selectedVendor && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="results">
              Stock Status
              {results && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({results.filter(r => r.status === 'critical' || r.status === 'low').length + manualItems.length})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analysis">New Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-6 mt-4">
            <Suspense fallback={<Card className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></Card>}>
              <AnalysisRunner
                vendorId={selectedVendor}
                onAnalysisComplete={handleAnalysisComplete}
              />
            </Suspense>

            <ManualOrderPanel
              vendorId={selectedVendor}
              currency={fileCurrency}
              sarRate={sarRate}
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
                  <Card key={run.id} className="p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {isSpreadsheet(run.pdf_file_name)
                          ? <FileSpreadsheet className="w-5 h-5 text-success shrink-0" />
                          : <FileText className="w-5 h-5 text-critical shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{run.pdf_file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {moment(run.created_date).format('MMM D, YYYY HH:mm')}
                            {run.report_date && (
                              <span className="ml-2">· report of {moment(run.report_date).format('MMM D, YYYY HH:mm')}</span>
                            )}
                            {run.status === 'completed' ? (
                              <>
                                <span className="text-warning ml-2">{run.items_to_purchase || 0} to purchase</span>
                                <span className="text-critical ml-2">{run.critical_items || 0} critical</span>
                                <span className="text-info ml-2">{run.unknown_items || 0} unknown</span>
                              </>
                            ) : (
                              <span className={`ml-2 capitalize ${run.status === 'failed' ? 'text-critical' : 'text-warning'}`}>{run.status}</span>
                            )}
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

          <TabsContent value="results" className="mt-4 space-y-4">
            {shownRun && (
              <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border ${
                shownRun.id === runs.find(r => r.status === 'completed')?.id ? 'bg-accent/5 border-accent/30' : 'bg-warning/5 border-warning/30'
              }`}>
                <div className="flex items-center gap-2 min-w-0 text-sm">
                  {isSpreadsheet(shownRun.pdf_file_name)
                    ? <FileSpreadsheet className="w-4 h-4 text-success shrink-0" />
                    : <FileText className="w-4 h-4 text-critical shrink-0" />}
                  <span className="font-medium truncate">{shownRun.pdf_file_name}</span>
                  <span className="text-muted-foreground whitespace-nowrap">· {moment(shownRun.created_date).fromNow()}</span>
                  {shownRun.id === runs.find(r => r.status === 'completed')?.id ? (
                    <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] font-medium">Latest</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[11px] font-medium">Older run</span>
                  )}
                </div>
                <div className="flex gap-2 sm:ml-auto">
                  {shownRun.id !== runs.find(r => r.status === 'completed')?.id && (
                    <Button size="sm" variant="outline" onClick={loadRuns}>Back to latest</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('analysis')}>
                    <RefreshCw className="w-4 h-4 mr-1.5" />Update with new report
                  </Button>
                </div>
              </div>
            )}
            {loadingLatest && !results ? (
              <Card className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></Card>
            ) : results ? (
              <ResultsTable
                results={results}
                vendorId={selectedVendor}
                vendorName={selectedVendorObj?.name}
                currency={fileCurrency}
                sarRate={sarRate}
                manualItems={manualItems}
                onDeleteManual={handleDeleteManual}
                onUpdateMinimum={handleUpdateMinimum}
                onUpdateQuantity={handleUpdateQuantity}
              />
            ) : (
              <Card className="p-8 text-center text-muted-foreground">
                <p className="text-sm">No analysis yet for this vendor.</p>
                <Button size="sm" className="mt-3" onClick={() => setActiveTab('analysis')}>Run the first analysis</Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}