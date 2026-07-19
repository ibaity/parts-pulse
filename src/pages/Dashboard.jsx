import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import StatCard from '@/components/StatCard';
import { Package, ShoppingCart, AlertTriangle, HelpCircle, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import moment from 'moment';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total_items: 0, items_to_purchase: 0, critical_items: 0, unknown_items: 0 });
  const [runs, setRuns] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorMap, setVendorMap] = useState(new Map());

  useEffect(() => {
    const load = async () => {
      try {
        const [latestRuns, allVendors] = await Promise.all([
          base44.entities.AnalysisRun.list('-created_date', 10),
          base44.entities.Vendor.list('-created_date', 100),
        ]);
        setRuns(latestRuns);
        setVendors(allVendors);
        setVendorMap(new Map(allVendors.map(v => [v.id, v])));
        const completed = latestRuns.find(r => r.status === 'completed');
        if (completed) {
          setStats({
            total_items: completed.total_items || 0,
            items_to_purchase: completed.items_to_purchase || 0,
            critical_items: completed.critical_items || 0,
            unknown_items: completed.unknown_items || 0,
          });
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of inventory analysis and purchase recommendations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Items" value={stats.total_items} icon={Package} accentClass="text-slate-700" subtitle="Unique items in last analysis" />
        <StatCard title="Items to Purchase" value={stats.items_to_purchase} icon={ShoppingCart} accentClass="text-amber-600" subtitle="Below minimum stock" />
        <StatCard title="Critical Items" value={stats.critical_items} icon={AlertTriangle} accentClass="text-red-600" subtitle="Zero stock" />
        <StatCard title="Unknown Items" value={stats.unknown_items} icon={HelpCircle} accentClass="text-purple-600" subtitle="Not in master file" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <h3 className="font-semibold mb-4">Recent Analysis Runs</h3>
          {runs.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No analysis runs yet.</p>
              <Link to="/analysis" className="text-xs text-primary hover:underline mt-2 inline-block">Run your first analysis</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Vendor</th>
                    <th className="text-left p-2 font-medium">File</th>
                    <th className="text-right p-2 font-medium">Purchase</th>
                    <th className="text-right p-2 font-medium">Critical</th>
                    <th className="text-right p-2 font-medium">Unknown</th>
                    <th className="text-left p-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => {
                    const vendor = vendorMap.get(run.vendor_id);
                    return (
                      <tr key={run.id} className="border-b hover:bg-muted/30">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            {vendor && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: vendor.color }} />}
                            <span className="font-medium">{vendor?.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground truncate max-w-[150px]">{run.pdf_file_name || '-'}</td>
                        <td className="p-2 text-right font-medium text-amber-600">{run.items_to_purchase || 0}</td>
                        <td className="p-2 text-right font-medium text-red-600">{run.critical_items || 0}</td>
                        <td className="p-2 text-right font-medium text-purple-600">{run.unknown_items || 0}</td>
                        <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{moment(run.created_date).format('MMM D, HH:mm')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Vendors</h3>
            <Link to="/vendors" className="text-xs text-primary hover:underline">Manage</Link>
          </div>
          {vendors.length === 0 ? (
            <div className="py-8 text-center">
              <Building2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No vendors yet.</p>
              <Link to="/vendors" className="text-xs text-primary hover:underline mt-2 inline-block">Add a vendor</Link>
            </div>
          ) : (
            <div className="space-y-1">
              {vendors.map(v => (
                <Link key={v.id} to="/analysis" className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: v.color + '20' }}>
                    <Building2 className="w-4 h-4" style={{ color: v.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{v.name}</p>
                    {v.description && <p className="text-xs text-muted-foreground truncate">{v.description}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}