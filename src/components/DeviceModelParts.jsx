import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Package, FileSpreadsheet } from 'lucide-react';

export default function DeviceModelParts({ model, vendor }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (model.master_file_id) {
          const items = await base44.entities.MasterItem.filter({ master_file_id: model.master_file_id }, '-created_date', 500);
          setParts(items);
        } else {
          setParts([]);
        }
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to load parts', variant: 'destructive' });
      }
      setLoading(false);
    };
    load();
  }, [model.id, model.master_file_id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!model.master_file_id) {
    return (
      <Card className="p-12 text-center">
        <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium">No master sheet linked</p>
        <p className="text-xs text-muted-foreground mt-1">Edit this model to link a master file and view its parts.</p>
      </Card>
    );
  }

  if (parts.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium">No parts in this master sheet</p>
        <p className="text-xs text-muted-foreground mt-1">The linked master file has no items.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSpreadsheet className="w-4 h-4" />
        <span>{parts.length} parts from master sheet</span>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Item Code</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-left p-3 font-medium">Min Stock</th>
                <th className="text-left p-3 font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              {parts.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs">{p.mediserv_item_code || p.manufacturer_item_code || '-'}</td>
                  <td className="p-3">{p.description || '-'}</td>
                  <td className="p-3 text-xs">{p.minimum_stock ?? '-'}</td>
                  <td className="p-3 text-xs">{p.category || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}