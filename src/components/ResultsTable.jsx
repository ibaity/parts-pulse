import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, PackageX, ArrowDownCircle, CheckCircle2, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { exportPurchaseExcel, exportPurchasePDF } from '@/lib/exportUtils';
import { getCurrencySymbol } from '@/lib/partConstants';

export default function ResultsTable({ results, vendorName, currency, manualItems = [] }) {
  const purchaseItems = results.filter(r => r.status !== 'unknown' && r.status !== 'sufficient');
  const unknownItems = results.filter(r => r.status === 'unknown');
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
    if (status === 'critical') return 'bg-red-50 text-red-700 border-red-200';
    if (status === 'low') return 'bg-amber-50 text-amber-700 border-amber-200';
    return '';
  };

  const formatPrice = (val) => {
    const n = Number(val) || 0;
    return n > 0 ? n.toLocaleString() : '-';
  };

  return (
    <div className="space-y-6">
      {purchaseItems.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <ArrowDownCircle className="w-5 h-5 text-amber-600" />
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
                {purchaseItems.map((r, i) => {
                  const price = Number(r.unit_price) || 0;
                  const total = price * (r.recommended_quantity || 0);
                  return (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{r.item_code}</td>
                      <td className="p-3 max-w-[300px] truncate">{r.description}</td>
                      <td className={`p-3 text-right font-medium ${r.current_stock === 0 ? 'text-red-600' : ''}`}>{r.current_stock}</td>
                      <td className="p-3 text-right">{r.minimum_stock}</td>
                      <td className="p-3 text-right font-bold text-primary">{r.recommended_quantity}</td>
                      <td className="p-3 text-right text-xs">{symbol} {formatPrice(price)}</td>
                      <td className="p-3 text-right text-xs font-semibold">{symbol} {formatPrice(total)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${statusStyle(r.status)}`}>
                          {r.status === 'critical' ? 'Critical' : 'Low'}
                        </span>
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
        <Card className="overflow-hidden border-purple-200">
          <div className="p-4 border-b bg-purple-50/50">
            <div className="flex items-center gap-2">
              <PackageX className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">Unknown Items</h3>
              <span className="text-sm text-purple-600">({unknownItems.length})</span>
              <span className="text-xs text-purple-600 ml-2">— found in PDF but missing from Master file</span>
            </div>
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

      {results.length === 0 && (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-sm font-medium">All stock levels are sufficient</p>
          <p className="text-xs text-muted-foreground mt-1">No items require purchase at this time.</p>
        </Card>
      )}
    </div>
  );
}