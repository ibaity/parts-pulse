import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, PackageX, ArrowDownCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ResultsTable({ results, vendorName }) {
  const purchaseItems = results.filter(r => r.status !== 'unknown');
  const unknownItems = results.filter(r => r.status === 'unknown');

  const handleExport = () => {
    const data = purchaseItems.map(r => ({
      'Item Code': r.item_code,
      'Description': r.description,
      'Current Stock': r.current_stock,
      'Minimum Stock': r.minimum_stock,
      'Recommended Quantity': r.recommended_quantity,
      'Status': r.status === 'critical' ? 'Critical' : 'Low',
      'Matched Via': r.matched_via === 'mediserv_code' ? 'Mediserv Code' : 'Manufacturer Code',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Purchase Recommendations');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `purchase_recommendations_${vendorName || 'vendor'}_${dateStr}.xlsx`);
  };

  const statusStyle = (status) => {
    if (status === 'critical') return 'bg-red-50 text-red-700 border-red-200';
    if (status === 'low') return 'bg-amber-50 text-amber-700 border-amber-200';
    return '';
  };

  return (
    <div className="space-y-6">
      {purchaseItems.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold">Purchase Recommendations</h3>
              <span className="text-sm text-muted-foreground">({purchaseItems.length} items)</span>
            </div>
            <Button onClick={handleExport} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-1.5" /> Export Excel
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Item Code</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-right p-3 font-medium">Current</th>
                  <th className="text-right p-3 font-medium">Min Stock</th>
                  <th className="text-right p-3 font-medium">Recommended</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchaseItems.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{r.item_code}</td>
                    <td className="p-3 max-w-[300px] truncate">{r.description}</td>
                    <td className={`p-3 text-right font-medium ${r.current_stock === 0 ? 'text-red-600' : ''}`}>{r.current_stock}</td>
                    <td className="p-3 text-right">{r.minimum_stock}</td>
                    <td className="p-3 text-right font-bold text-primary">{r.recommended_quantity}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${statusStyle(r.status)}`}>
                        {r.status === 'critical' ? 'Critical' : 'Low'}
                      </span>
                    </td>
                  </tr>
                ))}
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