import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, FileSpreadsheet, FlaskConical, Warehouse as WarehouseIcon, ListChecks, Monitor,
  ClipboardList, TrendingDown, BookOpen, Menu, X, ChevronDown, Settings,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Copyright from '@/components/Copyright';
import AppLogo from '@/components/AppLogo';
import { VendorProvider, useVendorSelection } from '@/hooks/useVendors';

export const APP_NAME = 'Part Plus';

const mainNav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/analysis', label: 'Analysis', icon: FlaskConical },
  { path: '/consumption', label: 'Consumption', icon: TrendingDown },
  { path: '/part-list', label: 'Part List', icon: ListChecks },
  { path: '/inventory-tracking', label: 'Stock Tracking', icon: ClipboardList },
  { path: '/device-models', label: 'Device Models', icon: Monitor },
  { path: '/parts-catalog', label: 'Parts Catalog', icon: BookOpen },
];

const setupNav = [
  { path: '/vendors', label: 'Vendors', icon: Building2 },
  { path: '/warehouses', label: 'Warehouses', icon: WarehouseIcon },
  { path: '/master-files', label: 'Master Files', icon: FileSpreadsheet },
];

const allNavItems = [...mainNav, ...setupNav];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0">
      <AppLogo className="w-9 h-9" title={APP_NAME} />
      <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
        Part <span className="text-sidebar-primary">Plus</span>
      </span>
    </Link>
  );
}

// Vendor is chosen once here and shared by every page.
function VendorSwitcher({ className = '' }) {
  const { vendors, selectedVendor, setSelectedVendor } = useVendorSelection();
  const current = vendors.find(v => v.id === selectedVendor);
  return (
    <Select value={selectedVendor || undefined} onValueChange={setSelectedVendor}>
      <SelectTrigger
        aria-label="Vendor"
        className={`h-9 rounded-full border-sidebar-border bg-sidebar-accent text-white text-sm font-medium gap-2 focus:ring-sidebar-ring ${className}`}
      >
        {!current && <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-sidebar-primary" />}
        <SelectValue placeholder="Vendor" />
      </SelectTrigger>
      <SelectContent align="end">
        {vendors.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No vendors yet — add one in Setup › Vendors</div>}
        {vendors.map(v => (
          <SelectItem key={v.id} value={v.id}>
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color || '#1f8f66' }} />{v.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NavLink({ item, active, onClick, block = false }) {
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
        block ? 'px-3 py-2.5' : 'px-3 py-1.5'
      } ${active ? 'bg-sidebar-accent text-white' : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white'}`}
    >
      <item.icon className={`w-4 h-4 shrink-0 ${block ? '' : 'hidden 2xl:block'} ${active ? 'text-sidebar-primary' : ''}`} />
      {item.label}
    </Link>
  );
}

function Shell() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPage = allNavItems.find(i => i.path === location.pathname);
  const inSetup = setupNav.some(i => i.path === location.pathname);

  // Browser tab shows the current page name.
  useEffect(() => {
    document.title = currentPage ? `${currentPage.label} · ${APP_NAME}` : APP_NAME;
  }, [currentPage]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="bg-sidebar shrink-0 relative z-30">
        <div className="h-14 px-4 lg:px-6 flex items-center gap-3 lg:gap-5">
          <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu" className="lg:hidden text-white p-1 -ml-1">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <Brand />

          <nav className="hidden lg:flex items-center gap-0.5 min-w-0">
            {mainNav.map(item => <NavLink key={item.path} item={item} active={location.pathname === item.path} />)}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium outline-none ${
                  inSetup ? 'bg-sidebar-accent text-white' : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white'
                }`}
              >
                <Settings className={`w-4 h-4 hidden 2xl:block ${inSetup ? 'text-sidebar-primary' : ''}`} />Setup<ChevronDown className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {setupNav.map(item => (
                  <DropdownMenuItem key={item.path} asChild className="cursor-pointer">
                    <Link to={item.path}><item.icon className="w-4 h-4 mr-2" />{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="ml-auto flex items-center min-w-0">
            <VendorSwitcher className="w-[160px] sm:w-[200px] 2xl:w-[240px]" />
          </div>
        </div>

        {/* Mobile / tablet menu */}
        {menuOpen && (
          <nav className="lg:hidden border-t border-sidebar-border px-3 py-3 space-y-0.5 max-h-[70vh] overflow-y-auto">
            {mainNav.map(item => <NavLink key={item.path} block item={item} active={location.pathname === item.path} />)}
            <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">Setup</p>
            {setupNav.map(item => <NavLink key={item.path} block item={item} active={location.pathname === item.path} />)}
          </nav>
        )}
      </header>

      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1 w-full max-w-[1440px] mx-auto">
          <Outlet />
        </div>
        <footer className="border-t px-4 py-5 text-center">
          <Copyright inline className="text-muted-foreground" />
        </footer>
      </main>
    </div>
  );
}

export default function Layout() {
  return (
    <VendorProvider>
      <Shell />
    </VendorProvider>
  );
}
