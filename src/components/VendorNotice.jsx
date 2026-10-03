import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useVendorSelection } from '@/hooks/useVendors';

// Shown on vendor-specific pages until a vendor is chosen in the top bar.
export default function VendorNotice() {
  const { vendors, vendorsLoading, selectedVendor } = useVendorSelection();
  if (selectedVendor || vendorsLoading) return null;
  return (
    <Card className="p-10 text-center shadow-sm">
      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
        <Building2 className="w-6 h-6 text-accent" />
      </div>
      {vendors.length === 0 ? (
        <>
          <p className="text-sm font-medium">No vendors yet</p>
          <Link to="/vendors" className="text-xs text-accent hover:underline mt-1 inline-block">Add your first vendor</Link>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">Choose a vendor</p>
          <p className="text-xs text-muted-foreground mt-1">Use the vendor selector at the top right — it applies to every page.</p>
        </>
      )}
    </Card>
  );
}
