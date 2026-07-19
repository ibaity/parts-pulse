import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const COLORS = ['#1E3A5F', '#6366F1', '#0EA5E9', '#F59E0B', '#EF4444', '#22C55E', '#8B5CF6', '#EC4899'];

export default function VendorDialog({ open, onClose, onSaved, vendor }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isEditing = !!vendor;

  useEffect(() => {
    if (open) {
      setName(vendor?.name || '');
      setDescription(vendor?.description || '');
      setColor(vendor?.color || COLORS[0]);
    }
  }, [open, vendor]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Vendor name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        color,
      };
      let saved;
      if (isEditing) {
        saved = await base44.entities.Vendor.update(vendor.id, payload);
        toast({ title: 'Success', description: 'Vendor updated successfully' });
      } else {
        saved = await base44.entities.Vendor.create(payload);
        toast({ title: 'Success', description: 'Vendor created successfully' });
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: isEditing ? 'Failed to update vendor' : 'Failed to create vendor', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Vendor Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. IMMUCOR" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition ${color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Update Vendor' : 'Save Vendor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}