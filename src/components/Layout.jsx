import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, FileSpreadsheet, FlaskConical, Warehouse as WarehouseIcon, Stethoscope, ListChecks } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/vendors', label: 'Vendors', icon: Building2 },
  { path: '/warehouses', label: 'Warehouses', icon: WarehouseIcon },
  { path: '/master-files', label: 'Master Files', icon: FileSpreadsheet },
  { path: '/part-list', label: 'Part List', icon: ListChecks },
  { path: '/analysis', label: 'Analysis', icon: FlaskConical },
];

export default function Layout() {
  const location = useLocation();
  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 bg-primary text-primary-foreground flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">MEDISERV</h1>
              <p className="text-[10px] text-sky-300">Inventory Analyzer</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <p className="text-[10px] text-slate-400">Spare Parts Analysis System</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}