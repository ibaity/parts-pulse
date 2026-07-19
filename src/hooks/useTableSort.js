import { useState, useMemo } from 'react';

export function useTableSort(items, defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      av = (av ?? '').toString().toLowerCase();
      bv = (bv ?? '').toString().toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [items, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return { sorted, sortKey, sortDir, toggleSort };
}