import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, FileSpreadsheet, FlaskConical, Warehouse as WarehouseIcon, Stethoscope, ListChecks, Monitor, ClipboardList, TrendingDown, Menu, X } from 'lucide-react';

const navSections = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/analysis', label: 'Analysis', icon: FlaskConical },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { path: '/part-list', label: 'Part List', icon: ListChecks },
      { path: '/consumption', label: 'Consumption', icon: TrendingDown },
      { path: '/inventory-tracking', label: 'Stock Tracking', icon: ClipboardList },
      { path: '/device-models', label: 'Device Models', icon: Monitor },
    ],
  },
  {
    title: 'Setup',
    items: [
      { path: '/vendors', label: 'Vendors', icon: Building2 },
      { path: '/warehouses', label: 'Warehouses', icon: WarehouseIcon },
      { path: '/master-files', label: 'Master Files', icon: FileSpreadsheet },
    ],
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sidebar-primary to-accent flex items-center justify-center shrink-0 shadow-lg shadow-black/20">
        <Stethoscope className="w-5 h-5 text-white" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-white">MEDISERV</p>
        <p className="text-[11px] text-sidebar-primary">Inventory Analyzer</p>
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sidebarContent = (
    <>
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Brand />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navSections.map(section => (
          <div key={section.title}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white'
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-sidebar-primary" />}
                    <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-sidebar-border">
        <p className="text-[11px] text-sidebar-foreground/60">Spare Parts Analysis System</p>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar text-sidebar-foreground flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex-col md:hidden ${
          sidebarOpen ? 'flex' : 'hidden'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
          className="absolute top-5 right-4 text-sidebar-foreground hover:text-white z-10"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-sidebar shrink-0 relative z-30">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="text-white p-1 -ml-1">
            <Menu className="w-6 h-6" />
          </button>
          <Brand />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
