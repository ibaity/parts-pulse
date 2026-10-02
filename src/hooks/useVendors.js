import { useEffect, useState } from 'react';
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

// Vendor list + selected vendor that is remembered across pages and visits.
export function useVendorSelection() {
  const { vendors, isLoading } = useVendors();
  const [searchParams] = useSearchParams();
  const [selectedVendor, setSelectedVendor] = useState(
    () => searchParams.get('vendor') || readStoredVendor()
  );

  useEffect(() => {
    try {
      if (selectedVendor) localStorage.setItem(STORAGE_KEY, selectedVendor);
    } catch {
      // storage unavailable — selection just isn't remembered
    }
  }, [selectedVendor]);

  // Drop a remembered vendor that no longer exists.
  useEffect(() => {
    if (!isLoading && selectedVendor && !vendors.some(v => v.id === selectedVendor)) {
      setSelectedVendor('');
    }
  }, [isLoading, vendors, selectedVendor]);

  return { vendors, vendorsLoading: isLoading, selectedVendor, setSelectedVendor };
}
