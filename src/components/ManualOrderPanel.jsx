import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Trash2, ShoppingCart } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/partConstants';

const normalizeCode = (s) => (s || '').toLowerCase().trim();

export default function ManualOrderPanel({ vendorId, currency, items, onAdded, onDeleted, onUpdated }) {
  const [masterItems, setMasterItems] = useState([]);
  const [quickCode, setQuickCode] = useState('');
  const [quickQty, setQuickQty] = useState('1');
  const [preview, setPreview] = useState(null);
  const [adding, setAdding] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customItem, setCustomItem] = useState({ item_code: '', description: '', quantity: 1, unit_price: 0 });
  const { toast } = useToast();

  const symbol = getCurrencySymbol(currency);

  useEffect(() => {
    if (vendorId) {
      base44.entities.MasterItem.filter({ vendor_id: vendorId }, '-created_date', 500)
        .then(setMasterItems)
        .catch(() => {});
    } else {
      setMasterItems([]);
    }
  }, [vendorId]);

  // Live preview as user types the code
  useEffect(() => {
    const code = quickCode.trim();
    if (!code) { setPreview(null); return; }
    const norm = normalizeCode(code);
    // Try exact match first
    let item = masterItems.find(
      i => normalizeCode(i.mediserv_item_code) === norm ||
           normalizeCode(i.manufacturer_item_code) === norm
    );
    // If no exact, try partial
    if (!item) {
      item = masterItems.find(
        i => (i.mediserv_item_code && normalizeCode(i.mediserv_item_code).includes(norm)) ||
             (i.manufacturer_item_code && normalizeCode(i.manufacturer_item_code).includes(norm))
      );
    }
    setPreview(item || null);
  }, [quickCode, masterItems]);

  const handleQuickAdd = async () => {
    const code = quickCode.trim();
    if (!code) return;
    const norm = normalizeCode(code);
    let item = masterItems.find(
      i => normalizeCode(i.mediserv_item_code) === norm ||
           normalizeCode(i.manufacturer_item_code) === norm
    );
    if (!item) {
      item = masterItems.find(
        i => (i.mediserv_item_code && normalizeCode(i.mediserv_item_code).includes(norm)) ||
             (i.manufacturer_item_code && normalizeCode(i.manufacturer_item_code).includes(norm))
      );
    }
    if (!item) {
      toast({ title: 'Not Found', description: 'No master item with this code. Use Custom Item button.', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      await base44.entities.ManualOrderItem.create({
        vendor_id: vendorId,
        item_code: item.mediserv_item_code || item.manufacturer_item_code || code,
        description: item.description || '',
        quantity: Number(quickQty) || 1,
        unit_price: Number(item.unit_price) || 0,
      });
      onAdded?.();
      setQuickCode('');
      setQuickQty('1');
      setPreview(null);
      toast({ title: 'Added', description: item.description || 'Item added' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add item', variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleAddCustom = async () => {
    if (!customItem.description.trim()) {
      toast({ title: 'Error', description: 'Description is required', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      await base44.entities.ManualOrderItem.create({
        vendor_id: vendorId,
        item_code: customItem.item_code,
        description: customItem.description,
        quantity: Number(customItem.quantity) || 1,
        unit_price: Number(customItem.unit_price) || 0,
      });
      onAdded?.();
      setCustomItem({ item_code: '', description: '', quantity: 1, unit_price: 0 });
      setShowCustom(false);
      toast({ title: 'Added', description: 'Custom item added' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add item', variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleUpdateQty = async (id, qty) => {
    try {
      await base44.entities.ManualOrderItem.update(id, { quantity: Number(qty) || 1 });
      onUpdated?.();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.ManualOrderItem.delete(id);
      onDeleted?.(id);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  return (
    <Card className="overflow-hidden border-blue-200">
      <div className="p-4 border-b bg-blue-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">Manual Order Items</h3>
          <span className="text-sm text-blue-600">({items.length})</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCustom(!showCustom)}>
          <Plus className="w-4 h-4 mr-1" /> Custom Item
        </Button>
      </div>

      <div className="p-4 space-y-3">
        {/* Quick add by code */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={quickCode}
              onChange={e => setQuickCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
              placeholder="Type item code and press Enter..."
              className="h-9 flex-1 font-mono"
            />
            <Input
              type="number"
              value={quickQty}
              onChange={e => setQuickQty(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
              placeholder="Qty"
              className="h-9 w-20 text-center"
            />
            <Button size="sm" onClick={handleQuickAdd} disabled={adding || !quickCode.trim()}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
          {/* Live preview */}
          {quickCode.trim() && (
            <div className={`text-xs px-3 py-2 rounded-md border ${preview ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              {preview ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{preview.description || 'No description'}</span>
                  <span className="shrink-0">{symbol} {(Number(preview.unit_price) || 0).toLocaleString()}</span>
                </div>
              ) : (
                'No matching master item. Use Custom Item to add manually.'
              )}
            </div>
          )}
        </div>

        {/* Custom item form */}
        {showCustom && (
          <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Item Code" value={customItem.item_code} onChange={e => setCustomItem({ ...customItem, item_code: e.target.value })} />
              <Input placeholder="Quantity" type="number" value={customItem.quantity} onChange={e => setCustomItem({ ...customItem, quantity: e.target.value })} />
            </div>
            <Input placeholder="Description *" value={customItem.description} onChange={e => setCustomItem({ ...customItem, description: e.target.value })} />
            <div className="flex items-center gap-2">
              <Input placeholder={`Price (${symbol})`} type="number" value={customItem.unit_price} onChange={e => setCustomItem({ ...customItem, unit_price: e.target.value })} />
              <Button size="sm" onClick={handleAddCustom} disabled={adding}>Add</Button>
            </div>
          </div>
        )}

        {/* Manual items table */}
        {items.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Item Code</th>
                  <th className="text-left p-2 font-medium">Description</th>
                  <th className="text-right p-2 font-medium">Qty</th>
                  <th className="text-right p-2 font-medium">Price</th>
                  <th className="text-right p-2 font-medium">Total</th>
                  <th className="text-center p-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-2 font-mono text-xs">{item.item_code || '-'}</td>
                    <td className="p-2">{item.description || '-'}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        className="w-16 bg-transparent rounded px-1 py-0.5 text-right text-xs focus:bg-white focus:ring-1 focus:ring-primary outline-none"
                        value={item.quantity}
                        onChange={e => handleUpdateQty(item.id, e.target.value)}
                      />
                    </td>
                    <td className="p-2 text-right text-xs">{symbol} {(Number(item.unit_price) || 0).toLocaleString()}</td>
                    <td className="p-2 text-right text-xs font-medium">{symbol} {((Number(item.unit_price) || 0) * (item.quantity || 0)).toLocaleString()}</td>
                    <td className="p-2 text-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}