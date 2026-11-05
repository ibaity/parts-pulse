import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchAll } from '@/lib/fetchAll';
import { indexNonStock, lookupNonStock } from '@/lib/nonStock';

export const NON_STOCK_QUERY_KEY = ['non-stock-index'];
const FIELDS = ['item_code', 'quantity', 'location_code', 'city', 'status'];

// Available non-stock parts, looked up by part number. Small list, so it loads with the catalog.
export function useNonStock() {
  const { data } = useQuery({
    queryKey: NON_STOCK_QUERY_KEY,
    queryFn: async () => indexNonStock(await fetchAll(base44.entities.NonStockItem, {}, '-created_date', FIELDS)),
    staleTime: 5 * 60 * 1000,
  });
  const lookup = useCallback((...codes) => lookupNonStock(data, codes.flat()), [data]);
  return { lookupNonStock: lookup };
}
