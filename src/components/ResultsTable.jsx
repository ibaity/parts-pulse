import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, PackageX, ArrowDownCircle, CheckCircle2, FileSpreadsheet, FileText, ChevronDown, Search, ArrowRight } from 'lucide-react';
import { exportPurchaseExcel, exportPurchasePDF } from '@/lib/exportUtils';
import { getCurrencySymbol } from '@/lib/partConstants';
import { isMissingFromReport } from '@/lib/analysisUtils';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'low', label: 'Low' },
  { key: 'missing', label: 'Not in report' },
];

const STATUS_ORDER = { critical: 0, low: 1 };

export default function ResultsTable({ results, vendorId, vendorName, currency, manualItems = [] }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const purchaseItems = useMemo(
    () => results
      .filter(r => r.status === 'critical' || r.status === 'low')
      .sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (b.recommended_quantity - a.recommended_quantity)),
    [results]
  );
  const unknownItems = results.filter(r => r.status === 'unknown');
  const counts = {
    all: purchaseItems.length,
    critical: purchaseItems.filter(r => r.status === 'critical').length,
    low: purchaseItems.filter(r => r.status === 'low').length,
    missing: purchaseItems.filter(isMissingFromReport).length,
  };
  const q = query.trim().toLowerCase();
  const visibleItems = purchaseItems.filter(r => {
    if (filter === 'missing' && !isMissingFromReport(r)) return false;
    if ((filter === 'critical' || filter === 'low') && r.status !== filter) return false;
    if (!q) return true;
    return (r.item_code || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
  });
  const symbol = getCurrencySymbol(currency);
  const normalizedManual = manualItems.map(m => ({
    item_code: m.item_code || '',
    description: m.description || '',
    current_stock: '-',
    minimum_stock: 0,
    recommended_quantity: Number(m.quantity) || 0,
    unit_price: Number(m.unit_price) || 0,
    status: 'manual',
  }));
  const allPurchaseItems = [...purchaseItems, ...normalizedManual];
  const grandTotal = allPurchaseItems.reduce((sum, r) => sum + (Number(r.unit_price) || 0) * (r.recommended_quantity || 0), 0);

  const handleExportExcel = () => exportPurchaseExcel(allPurchaseItems, vendorName, currency);
  const handleExportPDF = () => exportPurchasePDF(allPurchaseItems, vendorName, currency);

  const statusStyle = (status) => {
    if (status === 'critical') return 'bg-critical/10 text-critical border-critical/20';
    if (status === 'low') return 'bg-warning/10 text-warning border-warning/20';
    return '';
  };

  const formatPrice = (val) => {
    const n = Number(val) || 0;
    return n > 0 ? n.toLocaleString() : '-';
  };

  return (
    <div className="space-y-6">
      {purchaseItems.length > 0 && (
        <Card className="overflow-hidden shadow-sm">
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <ArrowDownCircle className="w-5 h-5 text-warning" />
              <h3 className="font-semibold">Purchase Recommendations</h3>
              <span className="text-sm text-muted-foreground">({purchaseItems.length} items)</span>
              {grandTotal > 0 && (
                <span className="text-sm font-bold text-primary ml-2">
                  Total: {symbol} {grandTotal.toLocaleString()}
                </span>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="w-4 h-4 mr-1.5" /> Export
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                  <FileText className="w-4 h-4 mr-2 text-red-600" /> PDF (.pdf)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center gap-3 bg-muted/30">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'
                  }`}
                >
                  {f.label} <span className="opacity-70">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className="relative sm:ml-auto sm:w-64">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code or description" className="h-8 pl-8 text-sm" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Item Code</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-right p-3 font-medium">Current</th>
                  <th className="text-right p-3 font-medium">Min Stock</th>
                  <th className="text-right p-3 font-medium">Rec. Qty</th>
                  <th className="text-right p-3 font-medium">Price</th>
                  <th className="text-right p-3 font-medium">Total</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">No items match this filter.</td></tr>
                )}
                {visibleItems.map((r, i) => {
                  const price = Number(r.unit_price) || 0;
                  const total = price * (r.recommended_quantity || 0);
                  const missing = isMissingFromReport(r);
                  return (
                    <tr key={r.id || i} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{r.item_code}</td>
                      <td className="p-3 max-w-[300px] truncate">{r.description}</td>
                      <td className={`p-3 text-right font-medium ${r.current_stock <= 0 ? 'text-critical' : ''}`}>{r.current_stock}</td>
                      <td className="p-3 text-right">{r.minimum_stock}</td>
                      <td className="p-3 text-right font-bold text-primary">{r.recommended_quantity}</td>
                      <td className="p-3 text-right text-xs">{symbol} {formatPrice(price)}</td>
                      <td className="p-3 text-right text-xs font-semibold">{symbol} {formatPrice(total)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${statusStyle(r.status)}`}>
                          {r.status === 'critical' ? 'Critical' : 'Low'}
                        </span>
                        {missing && (
                          <span className="block mt-1 text-[10px] text-muted-foreground whitespace-nowrap" title="In the master file but not found in the report — counted as zero stock">
                            Not in report
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {unknownItems.length > 0 && (
        <Card className="overflow-hidden border-info/30 shadow-sm">
          <div className="p-4 border-b bg-info/5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <PackageX className="w-5 h-5 text-info" />
              <h3 className="font-semibold">Unknown Items</h3>
              <span className="text-sm text-info">({unknownItems.length})</span>
              <span className="text-xs text-muted-foreground">— in the report but not in the master file</span>
            </div>
            {vendorId && (
              <Button asChild size="sm" variant="outline" className="sm:ml-auto">
                <Link to={`/part-list?vendor=${vendorId}`}>Classify in Part List<ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Item Code</th>
                  <th className="text-right p-3 font-medium">Stock Found</th>
                </tr>
              </thead>
              <tbody>
                {unknownItems.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{r.item_code}</td>
                    <td className="p-3 text-right">{r.current_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {purchaseItems.length === 0 && unknownItems.length === 0 && (
        <Card className="p-12 text-center shadow-sm">
          <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
          <p className="text-sm font-medium">All stock levels are sufficient</p>
          <p className="text-xs text-muted-foreground mt-1">No items require purchase at this time.</p>
        </Card>
      )}
    </div>
  );
}