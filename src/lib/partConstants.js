export const PART_CATEGORIES = [
  { value: 'Fast Moving', label: 'Fast Moving', desc: 'Less than 1 year' },
  { value: 'As Needed', label: 'As Needed', desc: 'As needed' },
  { value: 'Slow Part', label: 'Slow Part', desc: '1 - 3 years' },
  { value: 'Very Slow Part', label: 'Very Slow Part', desc: '3 - 5 years' },
  { value: 'Consumables', label: 'Consumables', desc: 'Consumables' },
  { value: 'Obsolete', label: 'Obsolete', desc: 'Obsolete' },
  { value: 'Tools', label: 'Tools', desc: 'Tools' },
];

export const CURRENCIES = [
  { code: 'SAR', symbol: 'ر.س', label: 'SAR (ر.س)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'AED', symbol: 'د.إ', label: 'AED (د.إ)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
];

export function getCurrencySymbol(code) {
  return CURRENCIES.find(c => c.code === code)?.symbol || code || '';
}

// Prices and money amounts always show two decimals, e.g. 1,250.00
export function formatPrice(value) {
  return (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

// SAR per 1 unit of a currency. USD and AED are pegged; others must be entered per price list.
export const DEFAULT_SAR_RATES = { SAR: 1, USD: 3.75, AED: 1.021 };

// Rate used to show SAR equivalents: 1 for SAR, else the price list's saved rate, else the peg. null = unknown.
export function getSarRate(currency, storedRate) {
  if (!currency || currency === 'SAR') return 1;
  const stored = Number(storedRate);
  if (stored > 0) return stored;
  return DEFAULT_SAR_RATES[currency] ?? null;
}

// True when prices are in another currency and can be shown in SAR too.
export const showsSar = (currency, rate) => !!currency && currency !== 'SAR' && Number(rate) > 0;

export const toSar = (value, rate) => (Number(rate) > 0 ? round2((Number(value) || 0) * rate) : null);

export function formatSar(value, rate) {
  const sar = toSar(value, rate);
  return sar === null ? '' : `${getCurrencySymbol('SAR')} ${formatPrice(sar)}`;
}

export function fuzzyMatch(query, target) {
  if (!query) return true;
  if (!target) return false;
  const q = query.toLowerCase().trim();
  const t = String(target).toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}