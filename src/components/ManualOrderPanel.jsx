import { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Search, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { fuzzyMatch, getCurrencySymbol } from '@/lib/partConstants';

export default function ManualOrderPanel({ vendorId, currency, items, onAdded, onDeleted, onUpdated }) {
  const [search, setSearch] = useState('');
  const [masterItems, setMasterItems] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customItem, setCustomItem] = useState({ item_code: '', description: '', quantity: 1, unit_price: 0 });
  const searchRef = useRef(null);
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

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return masterItems
      .filter(i =>
        fuzzyMatch(search, i.mediserv_item_code) ||
        fuzzyMatch(search, i.manufacturer_item_code) ||
        fuzzyMatch(search, i.description)
      )
      .slice(0, 10);
  }, [search, masterItems]);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAddFromMaster = async (item) => {
    setAdding(true);
    try {
      await base44.entities.ManualOrderItem.create({
        vendor_id: vendorId,
        item_code: item.mediserv_item_code || item.manufacturer_item_code || '',
        description: item.description || '',
        quantity: 1,
        unit_price: Number(item.unit_price) || 0,
      });
      onAdded?.();
      setSearch('');
      setShowResults(false);
      toast({ title: 'Added', description: 'Item added to manual order' });
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
        <div className="relative" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            placeholder="Search master items to add to order..."
            className="pl-9 h-9"
          />
          {showResults && search.trim() && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-auto">
              {searchResults.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No matches. Use "Custom Item" to add manually.</div>
              ) : (
                searchResults.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleAddFromMaster(item)}
                    disabled={adding}
                    className="w-full text-left p-2 hover:bg-muted/50 border-b last:border-0 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.description || 'No description'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.mediserv_item_code || item.manufacturer_item_code || '-'}</p>
                    </div>
                    <Plus className="w-4 h-4 text-primary shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>

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