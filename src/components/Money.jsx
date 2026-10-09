import { getCurrencySymbol, formatPrice, formatSar, showsSar } from '@/lib/partConstants';

// A price in the price list's currency, with its SAR equivalent underneath when the list is not in SAR.
export default function Money({ value, currency, sarRate, emptyText = '-', className = '' }) {
  const n = Number(value) || 0;
  if (n <= 0) return <span className={className}>{emptyText}</span>;
  return (
    <span className={`inline-flex flex-col items-end leading-tight ${className}`}>
      <bdi>{getCurrencySymbol(currency)} {formatPrice(n)}</bdi>
      {showsSar(currency, sarRate) && (
        <bdi className="text-[10px] font-normal text-muted-foreground">≈ {formatSar(n, sarRate)}</bdi>
      )}
    </span>
  );
}
