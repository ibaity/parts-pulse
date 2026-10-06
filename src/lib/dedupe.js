import { normalizeCode } from '@/lib/analysisUtils';

const time = (r) => new Date(r.updated_date || r.created_date || 0).getTime();
const newestFirst = (a, b) => time(b) - time(a);

// Manufacturer codes are often a brand name ("Werfen") shared by many different parts,
// so the mediserv code is the part's identity. A manufacturer code is only used for records
// that have no mediserv code, and only when almost nobody else uses it.
const MAX_SHARED_MANUFACTURER = 2;
const MAX_GROUP_SIZE = 5;

export function manufacturerUsage(masterItems) {
  const usage = new Map();
  for (const m of masterItems) {
    const code = normalizeCode(m.manufacturer_item_code);
    if (code) usage.set(code, (usage.get(code) || 0) + 1);
  }
  return usage;
}

// Unknown items are saved once per analysis run, so the same code repeats across reports.
// Keep one row per code (the newest) and remember every copy's id.
export function groupUnknownItems(unknownItems, masterItems) {
  const usage = manufacturerUsage(masterItems);
  const masterCodes = new Set();
  for (const m of masterItems) {
    const mediserv = normalizeCode(m.mediserv_item_code);
    const maker = normalizeCode(m.manufacturer_item_code);
    if (mediserv) masterCodes.add(mediserv);
    else if (maker && usage.get(maker) <= MAX_SHARED_MANUFACTURER) masterCodes.add(maker);
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

// Finds master items that are the same part recorded more than once.
// Returns { groups, suspicious }: groups are safe to merge; suspicious groups are too large
// to be a plain duplicate (probably unrelated parts sharing a code) and are never auto-merged.
export function findMasterDuplicates(masterItems) {
  const usage = manufacturerUsage(masterItems);
  const byKey = new Map();
  for (const m of masterItems) {
    const mediserv = normalizeCode(m.mediserv_item_code);
    const maker = normalizeCode(m.manufacturer_item_code);
    let key = null;
    if (mediserv) key = `m:${mediserv}`;
    else if (maker && usage.get(maker) <= MAX_SHARED_MANUFACTURER) key = `f:${maker}`;
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(m);
  }
  const groups = [];
  const suspicious = [];
  for (const g of byKey.values()) {
    if (g.length < 2) continue;
    (g.length > MAX_GROUP_SIZE ? suspicious : groups).push([...g].sort(newestFirst));
  }
  return { groups, suspicious };
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
