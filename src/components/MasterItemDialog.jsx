import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { PART_CATEGORIES, getCurrencySymbol } from '@/lib/partConstants';
import { fetchAll } from '@/lib/fetchAll';
import { normalizeCode } from '@/lib/analysisUtils';

export default function MasterItemDialog({ open, onOpenChange, vendorId, currency, onSaved }) {
  const [mediservCode, setMediservCode] = useState('');
  const [manufacturerCode, setManufacturerCode] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [minimumStock, setMinimumStock] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [unit, setUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setMediservCode('');
      setManufacturerCode('');
      setDescription('');
      setCategory('');
      setMinimumStock(0);
      setUnitPrice(0);
      setUnit('');
    }
  }, [open]);

  const handleSave = async () => {
    if (!description.trim() && !mediservCode.trim()) {
      toast({ title: 'Error', description: 'Please enter at least a code or description', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Don't create a second record for a code that already exists for this vendor.
      const codes = [mediservCode, manufacturerCode].map(normalizeCode).filter(Boolean);
      if (codes.length) {
        const existing = await fetchAll(base44.entities.MasterItem, { vendor_id: vendorId });
        const clash = existing.find(m => codes.includes(normalizeCode(m.mediserv_item_code)) || codes.includes(normalizeCode(m.manufacturer_item_code)));
        if (clash) {
          toast({
            title: 'Part already exists',
            description: `${clash.mediserv_item_code || clash.manufacturer_item_code}${clash.description ? ` — ${clash.description}` : ''} is already in the list. Edit it there instead.`,
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
      }
      await base44.entities.MasterItem.create({
        vendor_id: vendorId,
        mediserv_item_code: mediservCode.trim(),
        manufacturer_item_code: manufacturerCode.trim(),
        description: description.trim(),
        minimum_stock: Number(minimumStock) || 0,
        unit_price: Number(unitPrice) || 0,
        category: category || '',
        unit: unit.trim(),
      });
      toast({ title: 'Created', description: 'Part added to master list' });
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add part', variant: 'destructive' });
    }
    setSaving(false);
  };

  const symbol = getCurrencySymbol(currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Part</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mediserv Code</Label>
            <Input value={mediservCode} onChange={e => setMediservCode(e.target.value)} placeholder="e.g. D0064650" />
          </div>
          <div className="space-y-1.5">
            <Label>Manufacturer Code</Label>
            <Input value={manufacturerCode} onChange={e => setManufacturerCode(e.target.value)} placeholder="e.g. GE-001" />
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Part description" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category || 'uncategorized'} onValueChange={v => setCategory(v === 'uncategorized' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uncategorized">— None —</SelectItem>
                  {PART_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g. pcs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min Stock</Label>
              <Input type="number" value={minimumStock} onChange={e => setMinimumStock(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit Price ({symbol})</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Add Part'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}