import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import VendorDialog from '@/components/VendorDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Building2, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useQueryClient } from '@tanstack/react-query';
import { VENDORS_QUERY_KEY } from '@/hooks/useVendors';

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [deleteVendor, setDeleteVendor] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Vendor.list('-created_date', 100);
      setVendors(data);
      // Keep the shared vendor cache used by other pages in sync.
      queryClient.setQueryData(VENDORS_QUERY_KEY, data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = () => {
    setEditingVendor(null);
    setDialogOpen(true);
  };

  const handleEdit = (vendor) => {
    setEditingVendor(vendor);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteVendor) return;
    setDeleting(true);
    try {
      await base44.entities.Vendor.delete(deleteVendor.id);
      toast({ title: 'Deleted', description: `${deleteVendor.name} has been removed` });
      setDeleteVendor(null);
      load();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete vendor', variant: 'destructive' });
    }
    setDeleting(false);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl">
      <PageHeader icon={Building2} title="Vendors" subtitle="Manage vendor profiles — item codes are tied to each vendor">
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Vendor
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
        </div>
      ) : vendors.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">No vendors yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first vendor to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {vendors.map(v => (
            <Card key={v.id} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: v.color + '20' }}>
                <Building2 className="w-5 h-5" style={{ color: v.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{v.name}</p>
                {v.manufacturer_code && (
                  <p className="text-xs text-muted-foreground truncate font-mono">Code: {v.manufacturer_code}</p>
                )}
                {v.description && <p className="text-xs text-muted-foreground truncate">{v.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(v)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteVendor(v)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <VendorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
        vendor={editingVendor}
      />

      <AlertDialog open={!!deleteVendor} onOpenChange={(open) => !open && setDeleteVendor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteVendor?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}