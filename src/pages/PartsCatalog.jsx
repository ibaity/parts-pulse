import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Search, Copy, ExternalLink, ImageOff, Weight, Ruler, Warehouse, Loader2, Pencil, Upload, Link2, X, Plus } from 'lucide-react';
import catalog from '@/data/sparePartsCatalog.json';
import PageHeader from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { fuzzyMatch } from '@/lib/partConstants';
import { useCatalogStock } from '@/hooks/useCatalogStock';
import { findCatalogPart, searchCatalog, suggestCatalogParts, DEVICE_OPTIONS, splitModels } from '@/lib/catalogLookup';
import { useCatalogEntries } from '@/hooks/useCatalogEntries';
import { catalogCodeKey } from '@/lib/analysisUtils';
import { base44 } from '@/api/base44Client';

const PAGE_SIZE = 48;
const ALL = '__all__';
const STOCK_TAB = '__stock__';
const NONE = '__none__';
const imgSrc = (part) => part.imageUrl || `/catalog/img/${part.image}`;

function PartImage({ part, className = '' }) {
  const [failed, setFailed] = useState(false);
  if ((!part.image && !part.imageUrl) || failed) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}>
        <ImageOff className="w-6 h-6 opacity-50" />
      </div>
    );
  }
  return (
    <img
      src={imgSrc(part)}
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
        {part.stockTotal != null && (
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{part.stockTotal} in stock</Badge>
            {!part.entry && !part.image && <Badge variant="outline" className="text-warning border-warning/40">Needs info</Badge>}
          </div>
        )}
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

const deviceName = (id) => DEVICE_OPTIONS.find(d => d.id === id)?.name || '';

function CatalogLinker({ part, linked, onLink, onUnlink }) {
  const [q, setQ] = useState('');
  const suggestions = useMemo(
    () => (q.trim() ? searchCatalog(q, 6) : suggestCatalogParts(`${part.name} ${part.description}`, 4)),
    [q, part.name, part.description]
  );
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold"><Link2 className="w-4 h-4" />Link to catalog part</p>
      {linked ? (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <span className="min-w-0 truncate"><span className="font-mono text-accent">{linked.partNo}</span> · {linked.name}</span>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onUnlink} aria-label="Unlink"><X className="w-4 h-4" /></Button>
        </div>
      ) : (
        <>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the catalog by name or part number…" className="h-8 text-sm" />
          {!q.trim() && suggestions.length > 0 && <p className="text-[11px] text-muted-foreground">Suggested matches</p>}
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {suggestions.map(c => (
              <button key={`${c.device}-${c.partNo}`} type="button" onClick={() => onLink(c)}
                className="w-full text-left rounded-md border bg-card hover:border-accent px-3 py-1.5 text-sm flex items-center gap-2">
                <PartImage part={c} className="w-8 h-8 rounded border shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate"><span className="font-mono text-xs text-accent">{c.partNo}</span> · {c.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{c.deviceName} · {c.models}</span>
                </span>
              </button>
            ))}
            {q.trim() && suggestions.length === 0 && <p className="text-xs text-muted-foreground">No catalog match.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function ModelPicker({ options, value, onChange }) {
  const [custom, setCustom] = useState('');
  const all = [...new Set([...options, ...value])];
  const toggle = (m) => onChange(value.includes(m) ? value.filter(x => x !== m) : [...value, m]);
  const add = () => {
    const m = custom.trim();
    if (m && !value.includes(m)) onChange([...value, m]);
    setCustom('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {all.length === 0 && <span className="text-xs text-muted-foreground">Pick a device to see its models, or add one below.</span>}
        {all.map(m => (
          <button key={m} type="button" onClick={() => toggle(m)}>
            <Badge variant={value.includes(m) ? 'default' : 'outline'} className="cursor-pointer">{m}</Badge>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add another model…" className="h-8 text-sm" />
        <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={add} aria-label="Add model"><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

function EditForm({ part, entries, onDone }) {
  const { toast } = useToast();
  const [v, setV] = useState(() => ({
    name: part.name || '', supplierNo: part.supplierNo || '', device: part.device || '', section: part.section || '',
    models: splitModels(part.models), weight: part.weight || '', size: part.size || '', description: part.description || '',
    imageUrl: part.imageUrl || '', linkedPartNo: part.entry?.linked_part_no || '',
  }));
  const [uploading, setUploading] = useState(false);
  const set = (patch) => setV(prev => ({ ...prev, ...patch }));
  const linked = v.linkedPartNo ? findCatalogPart(v.linkedPartNo) : null;
  const device = DEVICE_OPTIONS.find(d => d.id === v.device);
  // Built-in parts already have their own record; the form is mainly for stocked parts missing from the catalog.
  const builtIn = !!part.image || !!findCatalogPart(part.partNo) && !part.entry?.linked_part_no && !part.stockTotal;

  const link = (c) => set({
    linkedPartNo: c.partNo, device: c.device, section: c.section, models: splitModels(c.models),
    weight: c.weight || v.weight, size: c.size || v.size, description: v.description || c.description,
    name: v.name && v.name !== part.partNo ? v.name : c.name,
  });

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set({ imageUrl: file_url });
    } catch {
      toast({ title: 'Image upload failed', variant: 'destructive' });
    }
    setUploading(false);
  };

  const submit = async () => {
    const code_key = catalogCodeKey(part.partNo) || catalogCodeKey(part.supplierNo);
    try {
      await entries.save.mutateAsync({
        existing: entries.find(part.partNo, part.supplierNo),
        values: {
          code_key, part_no: part.partNo, supplier_no: v.supplierNo, name: v.name, description: v.description,
          models: v.models.join(' / '), device: v.device, section: v.section, weight: v.weight, size: v.size,
          image_url: v.imageUrl, linked_part_no: v.linkedPartNo,
        },
      });
      toast({ title: 'Catalog entry saved' });
      onDone({ ...part, name: v.name, supplierNo: v.supplierNo, device: v.device, section: v.section, models: v.models.join(' / '),
        weight: v.weight, size: v.size, description: v.description, imageUrl: v.imageUrl, image: linked?.image || part.image });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {!builtIn && <CatalogLinker part={{ name: v.name, description: v.description }} linked={linked} onLink={link} onUnlink={() => set({ linkedPartNo: '' })} />}

      <div className="flex items-center gap-3">
        <PartImage part={{ image: linked?.image, imageUrl: v.imageUrl || undefined }} className="w-24 h-24 rounded-lg border shrink-0" />
        <div className="space-y-1">
          <Label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-2 hover:bg-muted">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}Upload image
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={e => upload(e.target.files?.[0])} />
          </Label>
          {v.imageUrl && <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => set({ imageUrl: '' })}>Remove uploaded image</button>}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Name</Label>
        <Input value={v.name} onChange={e => set({ name: e.target.value })} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Device</Label>
          <Select value={v.device || '__none__'} onValueChange={d => set({ device: d === '__none__' ? '' : d })}>
            <SelectTrigger><SelectValue placeholder="Choose device" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {DEVICE_OPTIONS.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Section</Label>
          <Input list="catalog-sections" value={v.section} onChange={e => set({ section: e.target.value })} placeholder="Pick or type…" />
          <datalist id="catalog-sections">
            {(device ? device.sections : DEVICE_OPTIONS.flatMap(d => d.sections)).map(sec => <option key={sec} value={sec} />)}
          </datalist>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Models {device && <span className="text-muted-foreground">· {device.name}</span>}</Label>
        <ModelPicker options={device ? device.models : []} value={v.models} onChange={models => set({ models })} />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1"><Label className="text-xs">Supplier / Mediserv No.</Label><Input value={v.supplierNo} onChange={e => set({ supplierNo: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Weight (kg)</Label><Input value={v.weight} onChange={e => set({ weight: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Size (cm)</Label><Input value={v.size} onChange={e => set({ size: e.target.value })} /></div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea value={v.description} onChange={e => set({ description: e.target.value })} rows={3} />
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={uploading || entries.save.isPending}>Save</Button>
        <Button variant="ghost" onClick={() => onDone(null)}>Cancel</Button>
      </div>
    </div>
  );
}

function PartDialog({ part, onClose, entries, onSaved }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(part.partNo);
      toast({ title: 'Part number copied', description: part.partNo });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };
  return (
    <Dialog open={!!part} onOpenChange={(o) => { if (!o) { setEditing(false); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {part && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{part.name}</DialogTitle>
              <DialogDescription>{part.section}</DialogDescription>
            </DialogHeader>
            {editing ? (
              <EditForm part={part} entries={entries} onDone={(saved) => { setEditing(false); if (saved) onSaved(saved); }} />
            ) : (
            <div className="grid sm:grid-cols-[220px_1fr] gap-5">
              <PartImage part={part} className="w-full h-56 rounded-lg border" />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-semibold">{part.partNo || '—'}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)} aria-label="Edit catalog entry">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {part.partNo && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copy} aria-label="Copy part number">
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <StockPanel part={part} />
                <Field label="Device">{deviceName(part.device)}</Field>
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
            )}
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
  const [deviceFilter, setDeviceFilter] = useState(ALL);
  const [selected, setSelected] = useState(
    () => (initialQ && findCatalogPart(initialQ)) || null
  );

  const entries = useCatalogEntries();
  const stockTab = group === STOCK_TAB;
  const { lookup, isLoading: stockLoading, error: stockError, masters } = useCatalogStock(inStockOnly || stockTab);

  // Master items currently in stock; falls back to master data when the built-in catalog has no entry.
  const stockItems = useMemo(() => {
    if (!masters) return [];
    const seen = new Set();
    const out = [];
    for (const m of masters) {
      const code = m.manufacturer_item_code || m.mediserv_item_code; // manufacturer code is blank when it was a shared label
      const key = catalogCodeKey(code) || catalogCodeKey(m.mediserv_item_code);
      if (!key || seen.has(key)) continue;
      const total = lookup(m.manufacturer_item_code, m.mediserv_item_code)?.total ?? 0;
      if (total <= 0) continue;
      seen.add(key);
      const base = findCatalogPart(m.manufacturer_item_code, m.mediserv_item_code) || {
        partNo: code, supplierNo: m.mediserv_item_code || '', name: m.description || code,
        description: '', models: '', section: m.category || 'Uncategorized',
      };
      out.push({ ...base, stockTotal: total });
    }
    return out;
  }, [masters, lookup]);

  const baseItems = useMemo(
    () => (stockTab ? stockItems : catalog.find(g => g.id === group).items.map(p => ({ ...p, device: group }))),
    [stockTab, stockItems, group]
  );
  const items = useMemo(() => baseItems.map(p => {
    const e = entries.find(p.partNo, p.supplierNo);
    if (!e) return p;
    const linked = e.linked_part_no ? findCatalogPart(e.linked_part_no) : null;
    return {
      ...p, entry: e,
      image: p.image || linked?.image,
      device: e.device || p.device,
      name: e.name || p.name, description: e.description || p.description, models: e.models || p.models,
      supplierNo: e.supplier_no || p.supplierNo, section: e.section || p.section,
      weight: e.weight || p.weight, size: e.size || p.size, imageUrl: e.image_url || '',
    };
  }), [baseItems, entries.find]);
  const sections = useMemo(
    () => [...new Set(items.filter(i => deviceFilter === ALL || (deviceFilter === NONE ? !i.device : i.device === deviceFilter)).map(i => i.section))].sort(),
    [items, deviceFilter]
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    return items.filter(i =>
      (section === ALL || i.section === section) &&
      (deviceFilter === ALL || (deviceFilter === NONE ? !i.device : i.device === deviceFilter)) &&
      (!q || i.partNo.includes(q) || i.supplierNo.includes(q) ||
        fuzzyMatch(q, i.name) || fuzzyMatch(q, i.description) || fuzzyMatch(q, i.models)) &&
      (!inStockOnly || stockTab || !!i.partNo && (lookup(i.partNo, i.supplierNo)?.total ?? 0) > 0)
    );
  }, [items, search, section, deviceFilter, inStockOnly, stockTab, lookup]);

  const changeGroup = (g) => { setGroup(g); setSection(ALL); setDeviceFilter(ALL); setLimit(PAGE_SIZE); };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <PageHeader
        icon={BookOpen}
        title="Parts Catalog"
        subtitle="Immucor spare parts reference with photos, part numbers and specs"
      />

      <Tabs value={group} onValueChange={changeGroup}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value={STOCK_TAB}>
            <Warehouse className="w-4 h-4 mr-1.5" />In Stock (Master)
            {masters && <Badge variant="secondary" className="ml-2">{stockItems.length}</Badge>}
          </TabsTrigger>
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
        {stockTab && (
          <Select value={deviceFilter} onValueChange={v => { setDeviceFilter(v); setSection(ALL); setLimit(PAGE_SIZE); }}>
            <SelectTrigger className="sm:w-[200px]"><SelectValue placeholder="Device" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All devices</SelectItem>
              {DEVICE_OPTIONS.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              <SelectItem value={NONE}>Not linked to a device</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={section} onValueChange={v => { setSection(v); setLimit(PAGE_SIZE); }}>
          <SelectTrigger className="sm:w-[320px]"><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sections</SelectItem>
            {sections.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {!stockTab && <Button
          variant={inStockOnly ? 'default' : 'outline'}
          onClick={() => { setInStockOnly(v => !v); setLimit(PAGE_SIZE); }}
          aria-pressed={inStockOnly}
        >
          {inStockOnly && stockLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Warehouse className="w-4 h-4 mr-2" />}
          In stock only
        </Button>}
      </div>

      {(inStockOnly || stockTab) && stockError && (
        <p className="text-sm text-critical">Could not load stock — showing no results.</p>
      )}

      <p className="text-sm text-muted-foreground">
        {(inStockOnly || stockTab) && stockLoading ? 'Checking stock…' : `${filtered.length} part${filtered.length === 1 ? '' : 's'}`}
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

      <PartDialog part={selected} onClose={() => setSelected(null)} entries={entries} onSaved={setSelected} />
    </div>
  );
}
