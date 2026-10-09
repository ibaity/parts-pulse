import { getCurrencySymbol, formatPrice, formatSar, showsSar } from '@/lib/partConstants';

// Prices are shown in SAR; hovering reveals the price list's original currency amount (e.g. the USD price).
// Lists already in SAR (or without a usable rate) show their own currency.
export default function Money({ value, currency, sarRate, emptyText = '-', className = '' }) {
  const n = Number(value) || 0;
  if (n <= 0) return <span className={className}>{emptyText}</span>;
  const original = `${getCurrencySymbol(currency)} ${formatPrice(n)}`;
  if (!showsSar(currency, sarRate)) return <span className={className}><bdi>{original}</bdi></span>;
  return (
    <span className={className} title={`${original}  (1 ${currency} = ${sarRate} SAR)`}>
      <bdi className="cursor-help">{formatSar(n, sarRate)}</bdi>
    </span>
  );
}
