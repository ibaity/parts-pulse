import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/fetchAll';
import { catalogCodeKey, catalogCodesInText } from '@/lib/analysisUtils';

const ITEM_FIELDS = ['item_code', 'description', 'current_stock', 'warehouse_breakdown'];
const MASTER_FIELDS = ['mediserv_item_code', 'manufacturer_item_code', 'description'];

const addAlias = (map, from, to) => {
  if (!from || !to || from === to) return;
  if (!map.has(from)) map.set(from, new Set());
  map.get(from).add(to);
};

// Current stock picture: the latest completed analysis of every vendor, indexed by item code.
// Master items link manufacturer codes (used by the catalog) to Mediserv codes (often used in reports);
// part numbers written in descriptions ("D IMMU 0065160 …") are linked too.
async function loadStockIndex() {
  const runs = await base44.entities.AnalysisRun.filter({ status: 'completed' }, '-created_date', 200);
  const latestByVendor = new Map();
  for (const r of runs) if (!latestByVendor.has(r.vendor_id)) latestByVendor.set(r.vendor_id, r);
  const latestRuns = [...latestByVendor.values()];

  const [itemLists, masters] = await Promise.all([
    Promise.all(latestRuns.map(run => fetchAll(base44.entities.AnalysisItem, { analysis_run_id: run.id }, '-created_date', ITEM_FIELDS))),
    fetchAll(base44.entities.MasterItem, {}, '-created_date', MASTER_FIELDS),
  ]);

  const byCode = new Map();
  const index = (key, item) => {
    if (!key) return;
    if (!byCode.has(key)) byCode.set(key, []);
    byCode.get(key).push(item);
  };
  itemLists.flat().forEach(item => {
    const own = catalogCodeKey(item.item_code);
    index(own, item);
    catalogCodesInText(item.description).forEach(k => k !== own && index(k, item));
    catalogCodesInText(item.item_code).forEach(k => k !== own && index(k, item));
  });

  const aliases = new Map();
  for (const mi of masters) {
    const m = catalogCodeKey(mi.mediserv_item_code);
    const f = catalogCodeKey(mi.manufacturer_item_code);
    addAlias(aliases, m, f);
    addAlias(aliases, f, m);
    for (const d of catalogCodesInText(mi.description)) {
      addAlias(aliases, d, m);
      addAlias(aliases, d, f);
    }
  }

  const lastUpdate = latestRuns.reduce((max, r) => (!max || r.created_date > max ? r.created_date : max), null);
  return { byCode, aliases, lastUpdate };
}

// Lazily loads stock (only once a part is opened) and returns a lookup by part number.
export function useCatalogStock(enabled) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['catalog-stock'],
    queryFn: loadStockIndex,
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const lookup = useCallback((...codes) => {
    if (!data) return null;
    const keys = new Set();
    for (const code of codes) {
      const key = catalogCodeKey(code);
      if (!key) continue;
      keys.add(key);
      (data.aliases.get(key) || []).forEach(a => keys.add(a));
    }
    if (keys.size === 0) return null;
    const items = new Set();
    keys.forEach(k => (data.byCode.get(k) || []).forEach(i => items.add(i)));

    let total = 0;
    const warehouses = new Map();
    for (const item of items) {
      total += Number(item.current_stock) || 0;
      for (const [wh, info] of Object.entries(item.warehouse_breakdown || {})) {
        const prev = warehouses.get(wh) || { warehouse: wh, name: info?.name || '', quantity: 0, enabled: false };
        prev.quantity += Number(info?.quantity) || 0;
        prev.enabled = prev.enabled || !!info?.enabled;
        warehouses.set(wh, prev);
      }
    }
    const rows = [...warehouses.values()]
      .filter(w => w.quantity !== 0)
      .sort((a, b) => (b.enabled - a.enabled) || (b.quantity - a.quantity));
    return { found: items.size > 0, total, warehouses: rows, codes: [...keys] };
  }, [data]);

  return { lookup, isLoading, error, lastUpdate: data?.lastUpdate };
}
