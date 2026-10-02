import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StatCard from '@/components/StatCard';
import { useVendors } from '@/hooks/useVendors';
import { Package, ShoppingCart, AlertTriangle, HelpCircle, Building2, FlaskConical, ChevronRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import moment from 'moment';

const STATUS_STYLES = {
  completed: 'bg-success/10 text-success',
  processing: 'bg-warning/10 text-warning',
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status || 'unknown'}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
      <Skeleton className="h-16 w-full max-w-md" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { vendors, isLoading: vendorsLoading } = useVendors();
  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['analysis-runs', 'recent'],
    queryFn: () => base44.entities.AnalysisRun.list('-created_date', 10),
  });

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v])), [vendors]);
  const latest = runs.find(r => r.status === 'completed');
  const stats = {
    total_items: latest?.total_items || 0,
    items_to_purchase: latest?.items_to_purchase || 0,
    critical_items: latest?.critical_items || 0,
    unknown_items: latest?.unknown_items || 0,
  };

  if (vendorsLoading || runsLoading) return <DashboardSkeleton />;

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-accent">{moment().format('dddd, MMMM D')}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of inventory analysis and purchase recommendations
            {latest && <> · last analysis {moment(latest.created_date).fromNow()}</>}
          </p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-sm self-start sm:self-auto">
          <Link to="/analysis"><FlaskConical className="w-4 h-4 mr-2" />New Analysis</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Items" value={stats.total_items} icon={Package} tone="primary" subtitle="Unique items in last analysis" />
        <StatCard title="Items to Purchase" value={stats.items_to_purchase} icon={ShoppingCart} tone="warning" subtitle="Below minimum stock" />
        <StatCard title="Critical Items" value={stats.critical_items} icon={AlertTriangle} tone="critical" subtitle="Zero stock" />
        <StatCard title="Unknown Items" value={stats.unknown_items} icon={HelpCircle} tone="info" subtitle="Not in master file" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="font-semibold">Recent Analysis Runs</h3>
            <Link to="/analysis" className="text-xs font-medium text-accent hover:underline inline-flex items-center">
              View all<ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {runs.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No analysis runs yet</p>
              <Link to="/analysis" className="text-xs text-accent hover:underline mt-1 inline-block">Run your first analysis</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-medium">Vendor</th>
                    <th className="text-left px-3 py-2.5 font-medium">Status</th>
                    <th className="text-right px-3 py-2.5 font-medium">Purchase</th>
                    <th className="text-right px-3 py-2.5 font-medium">Critical</th>
                    <th className="text-right px-3 py-2.5 font-medium">Unknown</th>
                    <th className="text-left px-5 py-2.5 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {runs.map(run => {
                    const vendor = vendorMap.get(run.vendor_id);
                    return (
                      <tr key={run.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: vendor?.color || 'hsl(var(--muted-foreground))' }} />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{vendor?.name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{run.pdf_file_name || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3"><StatusBadge status={run.status} /></td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-warning">{run.items_to_purchase || 0}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-critical">{run.critical_items || 0}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-info">{run.unknown_items || 0}</td>
                        <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{moment(run.created_date).format('MMM D, HH:mm')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h3 className="font-semibold">Vendors</h3>
            <Link to="/vendors" className="text-xs font-medium text-accent hover:underline">Manage</Link>
          </div>
          {vendors.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No vendors yet</p>
              <Link to="/vendors" className="text-xs text-accent hover:underline mt-1 inline-block">Add a vendor</Link>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {vendors.map(v => {
                const color = v.color || '#1E3A5F';
                return (
                  <Link key={v.id} to={`/analysis?vendor=${v.id}`} className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold" style={{ backgroundColor: color + '1A', color }}>
                      {(v.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      {v.description && <p className="text-xs text-muted-foreground truncate">{v.description}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
