import catalog from '@/data/sparePartsCatalog.json';
import { catalogCodeKey as norm } from '@/lib/analysisUtils';

// Part number -> first catalog entry that has a photo (falls back to any entry).
const byPartNo = new Map();
for (const group of catalog) {
  for (const part of group.items) {
    const key = norm(part.partNo);
    if (!key) continue;
    const existing = byPartNo.get(key);
    if (!existing || (!existing.image && part.image)) byPartNo.set(key, part);
  }
}

export function findCatalogPart(...codes) {
  for (const code of codes) {
    const part = byPartNo.get(norm(code));
    if (part) return part;
  }
  return null;
}
