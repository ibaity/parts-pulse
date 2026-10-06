import { normalizeCode } from '@/lib/analysisUtils';

const time = (r) => new Date(r.updated_date || r.created_date || 0).getTime();
const newestFirst = (a, b) => time(b) - time(a);

// Unknown items are saved once per analysis run, so the same code repeats across reports.
// Keep one row per code (the newest) and remember every copy's id.
export function groupUnknownItems(unknownItems, masterItems) {
  const masterCodes = new Set();
  for (const m of masterItems) {
    const a = normalizeCode(m.mediserv_item_code);
    const b = normalizeCode(m.manufacturer_item_code);
    if (a) masterCodes.add(a);
    if (b) masterCodes.add(b);
  }
  const groups = new Map();
  for (const u of unknownItems) {
    const code = normalizeCode(u.item_code);
    if (!code || masterCodes.has(code)) continue;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(u);
  }
  return [...groups.values()].map(copies => {
    const sorted = [...copies].sort(newestFirst);
    return { ...sorted[0], duplicateIds: sorted.map(c => c.id), reportCount: sorted.length };
  });
}

// Master items that share a normalized mediserv OR manufacturer code are the same part.
// Union-find joins chains (A=B by one code, B=C by the other).
export function findMasterDuplicates(masterItems) {
  const parent = masterItems.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const firstByCode = new Map();
  masterItems.forEach((m, i) => {
    for (const field of ['mediserv_item_code', 'manufacturer_item_code']) {
      const code = normalizeCode(m[field]);
      if (!code) continue;
      const key = `${field}:${code}`;
      if (firstByCode.has(key)) parent[find(i)] = find(firstByCode.get(key));
      else firstByCode.set(key, i);
    }
  });
  const groups = new Map();
  masterItems.forEach((m, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(m);
  });
  return [...groups.values()].filter(g => g.length > 1).map(g => [...g].sort(newestFirst));
}

const MERGE_FIELDS = ['mediserv_item_code', 'manufacturer_item_code', 'description', 'category', 'unit', 'master_file_id', 'minimum_stock', 'unit_price'];
const NUMERIC = new Set(['minimum_stock', 'unit_price']);

const isEmpty = (field, value) =>
  value === undefined || value === null || value === '' || (NUMERIC.has(field) && (Number(value) || 0) === 0);

// Newest record wins; its empty fields are filled from older copies (newest first).
export function planMerge(group) {
  const [keep, ...rest] = [...group].sort(newestFirst);
  const changes = {};
  for (const field of MERGE_FIELDS) {
    if (!isEmpty(field, keep[field])) continue;
    const donor = rest.find(r => !isEmpty(field, r[field]));
    if (donor) changes[field] = donor[field];
  }
  return { keepId: keep.id, keep, changes, removeIds: rest.map(r => r.id) };
}
