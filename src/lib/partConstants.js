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