import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function DeviceModelDialog({ open, onOpenChange, editing, onSaved }) {
  const [name, setName] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [masterFileId, setMasterFileId] = useState('');
  const [description, setDescription] = useState('');
  const [vendors, setVendors] = useState([]);
  const [masterFiles, setMasterFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName(editing?.name || '');
      setVendorId(editing?.vendor_id || '');
      setMasterFileId(editing?.master_file_id || '');
      setDescription(editing?.description || '');
      base44.entities.Vendor.list('-created_date', 200).then(setVendors).catch(() => {});
    }
  }, [open, editing]);

  useEffect(() => {
    if (vendorId) {
      base44.entities.MasterFile.filter({ vendor_id: vendorId }, '-created_date', 100)
        .then(setMasterFiles)
        .catch(() => setMasterFiles([]));
    } else {
      setMasterFiles([]);
      setMasterFileId('');
    }
  }, [vendorId]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name, vendor_id: vendorId, master_file_id: masterFileId, description };
      if (editing) {
        await base44.entities.DeviceModel.update(editing.id, payload);
        toast({ title: 'Updated', description: 'Device model updated' });
      } else {
        await base44.entities.DeviceModel.create(payload);
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
            <Label>Company / Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue placeholder="Select vendor..." /></SelectTrigger>
              <SelectContent>
                {vendors.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{v.manufacturer_code ? ` (${v.manufacturer_code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Master Sheet</Label>
            <Select value={masterFileId} onValueChange={setMasterFileId} disabled={!vendorId}>
              <SelectTrigger><SelectValue placeholder={vendorId ? 'Select master file...' : 'Select vendor first'} /></SelectTrigger>
              <SelectContent>
                {masterFiles.length === 0 && vendorId ? (
                  <SelectItem value="_none" disabled>No master files for this vendor</SelectItem>
                ) : (
                  masterFiles.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.file_name} ({f.item_count} items)</SelectItem>
                  ))
                )}
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