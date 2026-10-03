import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const VENDORS_QUERY_KEY = ['vendors'];
const STORAGE_KEY = 'parts-pulse:selected-vendor';

const readStoredVendor = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

// Shared, cached vendor list — fetched once and reused across pages.
export function useVendors() {
  const { data = [], isLoading } = useQuery({
    queryKey: VENDORS_QUERY_KEY,
    queryFn: () => base44.entities.Vendor.list('-created_date', 100),
    staleTime: 5 * 60 * 1000,
  });
  return { vendors: data, isLoading };
}

const VendorContext = createContext(null);

// One vendor selection for the whole app (chosen in the top bar), remembered across visits.
// A ?vendor= link (e.g. from the Dashboard) switches it.
export function VendorProvider({ children }) {
  const { vendors, isLoading } = useVendors();
  const [searchParams] = useSearchParams();
  const urlVendor = searchParams.get('vendor');
  const [selectedVendor, setSelectedVendor] = useState(() => urlVendor || readStoredVendor());

  useEffect(() => {
    if (urlVendor) setSelectedVendor(urlVendor);
  }, [urlVendor]);

  useEffect(() => {
    try {
      if (selectedVendor) localStorage.setItem(STORAGE_KEY, selectedVendor);
    } catch {
      // storage unavailable — selection just isn't remembered
    }
  }, [selectedVendor]);

  // Drop a remembered vendor that no longer exists; pick the only vendor automatically.
  useEffect(() => {
    if (isLoading) return;
    if (selectedVendor && !vendors.some(v => v.id === selectedVendor)) setSelectedVendor('');
    else if (!selectedVendor && vendors.length === 1) setSelectedVendor(vendors[0].id);
  }, [isLoading, vendors, selectedVendor]);

  const value = useMemo(
    () => ({ vendors, vendorsLoading: isLoading, selectedVendor, setSelectedVendor }),
    [vendors, isLoading, selectedVendor]
  );
  return createElement(VendorContext.Provider, { value }, children);
}

export function useVendorSelection() {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error('useVendorSelection must be used inside <VendorProvider>');
  return ctx;
}
