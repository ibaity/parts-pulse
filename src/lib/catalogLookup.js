import catalog from '@/data/sparePartsCatalog.json';
import { catalogCodeKey as norm } from '@/lib/analysisUtils';

// Every built-in part, tagged with the device (catalog group) it belongs to.
const allParts = catalog.flatMap(g => g.items.map(p => ({ ...p, device: g.id, deviceName: g.name })));

// Part number -> first catalog entry that has a photo (falls back to any entry).
const byPartNo = new Map();
for (const part of allParts) {
  const key = norm(part.partNo);
  if (!key) continue;
  const existing = byPartNo.get(key);
  if (!existing || (!existing.image && part.image)) byPartNo.set(key, part);
}

export function findCatalogPart(...codes) {
  for (const code of codes) {
    const part = byPartNo.get(norm(code));
    if (part) return part;
  }
  return null;
}

// Devices with their sections and individual models, for pickers.
const splitModels = (m) => (m || '').split('/').map(x => x.trim()).filter(Boolean);
export const DEVICE_OPTIONS = catalog.map(g => ({
  id: g.id,
  name: g.name,
  sections: [...new Set(g.items.map(i => i.section).filter(Boolean))].sort(),
  models: [...new Set(g.items.flatMap(i => splitModels(i.models)))].sort(),
}));
export { splitModels };

const tokens = (text) => (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3);

// Free-text search over the built-in catalog (part number, name, description, models).
export function searchCatalog(query, limit = 8) {
  const q = (query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const key = norm(q);
  const qt = tokens(q);
  return allParts
    .map(p => {
      let score = 0;
      if (key && norm(p.partNo).includes(key)) score += 5;
      const hay = `${p.name} ${p.description} ${p.models} ${p.section}`.toLowerCase();
      if (hay.includes(q)) score += 3;
      score += qt.filter(t => hay.includes(t)).length;
      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.p);
}

// Closest built-in parts for a stocked item that has no catalog entry, judged by its name/description words.
export function suggestCatalogParts(text, limit = 4) {
  const qt = new Set(tokens(text));
  if (qt.size === 0) return [];
  return allParts
    .map(p => {
      const pt = new Set(tokens(`${p.name} ${p.description}`));
      let hit = 0;
      qt.forEach(t => pt.has(t) && hit++);
      return { p, score: hit / Math.sqrt(qt.size * Math.max(pt.size, 1)) };
    })
    .filter(x => x.score >= 0.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.p);
}
