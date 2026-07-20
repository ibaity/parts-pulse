import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const CATEGORIES = ['MRI', 'CT Scanner', 'Ultrasound', 'X-Ray', 'Mammography', 'Fluoroscopy', 'Angiography', 'PET', 'Other'];

export default function DeviceModelDialog({ open, onOpenChange, editing, onSaved }) {
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [category, setCategory] = useState('Other');
  const [description, setDescription] = useState('');
  const [vendors, setVendors] = useState([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(editing?.name || '');
      setManufacturer(editing?.manufacturer || '');
      setCategory(editing?.category || 'Other');
      setDescription(editing?.description || '');
      base44.entities.Vendor.list('-created_date', 200).then(setVendors).catch(() => {});
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.DeviceModel.update(editing.id, { name, manufacturer, category, description });
        toast({ title: 'Updated', description: 'Device model updated' });
      } else {
        await base44.entities.DeviceModel.create({ name, manufacturer, category, description });
        toast({ title: 'Created', description: 'Device model added' });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Device Model' : 'Add Device Model'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Model Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Optima CT540" />
          </div>
          <div className="space-y-1.5">
            <Label>Manufacturer</Label>
            <Select value={manufacturer} onValueChange={setManufacturer}>
              <SelectTrigger><SelectValue placeholder="Select vendor / company..." /></SelectTrigger>
              <SelectContent>
                {vendors.map(v => (
                  <SelectItem key={v.id} value={v.name}>{v.name}{v.manufacturer_code ? ` (${v.manufacturer_code})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional notes" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}