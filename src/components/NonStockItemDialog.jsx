import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export const NON_STOCK_CITIES = ['Riyadh', 'Jeddah'];

export default function NonStockItemDialog({ open, onClose, onSaved, item, defaultCity }) {
  const [itemCode, setItemCode] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState(NON_STOCK_CITIES[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isEditing = !!item;

  useEffect(() => {
    if (open) {
      setItemCode(item?.item_code || '');
      setDescription(item?.description || '');
      setQuantity(String(item?.quantity ?? 1));
      setUnit(item?.unit || '');
      setCity(item?.city || defaultCity || NON_STOCK_CITIES[0]);
      setNotes(item?.notes || '');
    }
  }, [open, item, defaultCity]);

  const handleSave = async () => {
    if (!itemCode.trim()) {
      toast({ title: 'Error', description: 'Item code is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        item_code: itemCode.trim(),
        description: description.trim(),
        quantity: Number(quantity) || 0,
        unit: unit.trim(),
        city,
        notes: notes.trim(),
      };
      if (isEditing) {
        await base44.entities.NonStockItem.update(item.id, payload);
        toast({ title: 'Success', description: 'Item updated' });
      } else {
        await base44.entities.NonStockItem.create({ ...payload, status: 'available' });
        toast({ title: 'Success', description: 'Item added' });
      }
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: isEditing ? 'Failed to update item' : 'Failed to add item', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Non-Stock Item' : 'Add Non-Stock Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Item Code *</Label>
            <Input value={itemCode} onChange={e => setItemCode(e.target.value)} placeholder="e.g. D0065071" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min="0" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="EA" />
            </div>
            <div className="space-y-2">
              <Label>City *</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NON_STOCK_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Where it is, condition, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Update Item' : 'Save Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
