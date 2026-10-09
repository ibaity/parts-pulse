import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Search, Copy, ExternalLink, ImageOff, Weight, Ruler, Warehouse, Loader2 } from 'lucide-react';
import catalog from '@/data/sparePartsCatalog.json';
import PageHeader from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { fuzzyMatch } from '@/lib/partConstants';
import { useCatalogStock } from '@/hooks/useCatalogStock';
import { findCatalogPart } from '@/lib/catalogLookup';

const PAGE_SIZE = 48;
const ALL = '__all__';
const imgSrc = (file) => `/catalog/img/${file}`;

function PartImage({ part, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!part.image || failed) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}>
        <ImageOff className="w-6 h-6 opacity-50" />
      </div>
    );
  }
  return (
    <img
      src={imgSrc(part.image)}
      alt={part.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-contain bg-white ${className}`}
    />
  );
}

function PartCard({ part, onOpen }) {
  return (
    <button
      onClick={() => onOpen(part)}
      className="text-left rounded-xl border bg-card hover:border-accent hover:shadow-sm transition overflow-hidden flex flex-col"
    >
      <PartImage part={part} className="w-full h-32 border-b" />
      <div className="p-3 space-y-1 min-w-0">
        <p className="font-mono text-xs text-accent font-semibold">{part.partNo || '—'}</p>
        <p className="text-sm font-medium leading-snug line-clamp-2">{part.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">{part.models || part.section}</p>
      </div>
    </button>
  );
}

function Field({ label, children }) {
  if (!children) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

function StockPanel({ part }) {
  const { lookup, isLoading, error, lastUpdate } = useCatalogStock(!!part.partNo);
  if (!part.partNo) return null;
  const stock = lookup(part.partNo, part.supplierNo);

  let body;
  if (isLoading) {
    body = <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading stock…</p>;
  } else if (error) {
    body = <p className="text-sm text-critical">Could not load stock.</p>;
  } else if (!stock?.found || stock.warehouses.length === 0) {
    body = <p className="text-sm text-muted-foreground">Not in stock in any warehouse (latest stock report).</p>;
  } else {
    body = (
      <div className="space-y-1.5">
        {stock.warehouses.map(w => (
          <div
            key={w.warehouse}
            className={`flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 text-sm ${w.enabled ? 'bg-card' : 'bg-muted text-muted-foreground'}`}
            title={w.enabled ? 'Counted in stock' : 'Warehouse disabled — not counted'}
          >
            <span className="min-w-0 truncate">
              {w.warehouse}{w.name && <span className="text-muted-foreground"> · {w.name}</span>}
            </span>
            <span className="font-semibold tabular-nums">{w.quantity}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Warehouse className="w-4 h-4" />Stock on hand</p>
        {stock?.found && <Badge variant={stock.total > 0 ? 'default' : 'destructive'}>{stock.total} total</Badge>}
      </div>
      {body}
      {stock?.codes?.length > 0 && (
        <p className="text-[11px] text-muted-foreground">Codes checked: {stock.codes.join(', ')}</p>
      )}
      {lastUpdate && (
        <p className="text-[11px] text-muted-foreground">
          Latest stock report: {new Date(lastUpdate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </p>
      )}
    </div>
  );
}

function PartDialog({ part, onClose }) {
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(part.partNo);
      toast({ title: 'Part number copied', description: part.partNo });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };
  return (
    <Dialog open={!!part} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {part && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{part.name}</DialogTitle>
              <DialogDescription>{part.section}</DialogDescription>
            </DialogHeader>
            <div className="grid sm:grid-cols-[220px_1fr] gap-5">
              <PartImage part={part} className="w-full h-56 rounded-lg border" />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-semibold">{part.partNo || '—'}</span>
                  {part.partNo && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copy} aria-label="Copy part number">
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <StockPanel part={part} />
                <Field label="Models">{part.models}</Field>
                <Field label="Supplier No.">{part.supplierNo}</Field>
                {part.weight && <Field label="Weight"><span className="inline-flex items-center gap-1"><Weight className="w-3.5 h-3.5" />{part.weight} kg</span></Field>}
                {part.size && <Field label="Size (cm)"><span className="inline-flex items-center gap-1"><Ruler className="w-3.5 h-3.5" />{part.size}</span></Field>}
                <Field label="Description">{part.description}</Field>
                {part.imageLink && (
                  <a href={part.imageLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                    <ExternalLink className="w-4 h-4" />Open full-size image
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function PartsCatalog() {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [group, setGroup] = useState(
    (catalog.find(g => initialQ && g.items.some(i => i.partNo === initialQ)) || catalog[0]).id
  );
  const [search, setSearch] = useState(initialQ);
  const [section, setSection] = useState(ALL);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selected, setSelected] = useState(
    () => (initialQ && findCatalogPart(initialQ)) || null
  );

  const current = catalog.find(g => g.id === group);
  const sections = useMemo(() => [...new Set(current.items.map(i => i.section))].sort(), [current]);

  const { lookup, isLoading: stockLoading, error: stockError } = useCatalogStock(inStockOnly);

  const filtered = useMemo(() => {
    const q = search.trim();
    return current.items.filter(i =>
      (section === ALL || i.section === section) &&
      (!q || i.partNo.includes(q) || i.supplierNo.includes(q) ||
        fuzzyMatch(q, i.name) || fuzzyMatch(q, i.description) || fuzzyMatch(q, i.models)) &&
      (!inStockOnly || !!i.partNo && (lookup(i.partNo, i.supplierNo)?.total ?? 0) > 0)
    );
  }, [current, search, section, inStockOnly, lookup]);

  const changeGroup = (g) => { setGroup(g); setSection(ALL); setLimit(PAGE_SIZE); };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <PageHeader
        icon={BookOpen}
        title="Parts Catalog"
        subtitle="Immucor spare parts reference with photos, part numbers and specs"
      />

      <Tabs value={group} onValueChange={changeGroup}>
        <TabsList className="h-auto flex-wrap justify-start">
          {catalog.map(g => (
            <TabsTrigger key={g.id} value={g.id}>
              {g.name}<Badge variant="secondary" className="ml-2">{g.items.length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setLimit(PAGE_SIZE); }}
            placeholder="Search part number, name, description or model…"
            className="pl-9"
          />
        </div>
        <Select value={section} onValueChange={v => { setSection(v); setLimit(PAGE_SIZE); }}>
          <SelectTrigger className="sm:w-[320px]"><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sections</SelectItem>
            {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={inStockOnly ? 'default' : 'outline'}
          onClick={() => { setInStockOnly(v => !v); setLimit(PAGE_SIZE); }}
          aria-pressed={inStockOnly}
        >
          {inStockOnly && stockLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Warehouse className="w-4 h-4 mr-2" />}
          In stock only
        </Button>
      </div>

      {inStockOnly && stockError && (
        <p className="text-sm text-critical">Could not load stock — showing no results.</p>
      )}

      <p className="text-sm text-muted-foreground">
        {inStockOnly && stockLoading ? 'Checking stock…' : `${filtered.length} part${filtered.length === 1 ? '' : 's'}`}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No parts match your search.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {filtered.slice(0, limit).map((p, idx) => <PartCard key={`${p.partNo}-${idx}`} part={p} onOpen={setSelected} />)}
        </div>
      )}

      {filtered.length > limit && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimit(l => l + PAGE_SIZE)}>
            Show more ({filtered.length - limit} remaining)
          </Button>
        </div>
      )}

      <PartDialog part={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
