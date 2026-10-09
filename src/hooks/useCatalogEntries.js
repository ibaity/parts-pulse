import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/fetchAll';
import { catalogCodeKey } from '@/lib/analysisUtils';

// User-maintained catalog data (name, specs, photo) layered over the built-in catalog,
// and the only source for stocked master items that are not in the built-in catalog.
export function useCatalogEntries() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['catalog-entries'],
    queryFn: () => fetchAll(base44.entities.CatalogEntry, {}),
    staleTime: 5 * 60 * 1000,
  });

  const byKey = useMemo(() => new Map((data || []).map(e => [e.code_key, e])), [data]);
  const find = useCallback((...codes) => {
    for (const c of codes) {
      const e = byKey.get(catalogCodeKey(c));
      if (e) return e;
    }
    return null;
  }, [byKey]);

  const save = useMutation({
    mutationFn: async ({ existing, values }) => (
      existing
        ? base44.entities.CatalogEntry.update(existing.id, values)
        : base44.entities.CatalogEntry.create(values)
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog-entries'] }),
  });

  return { find, save };
}
