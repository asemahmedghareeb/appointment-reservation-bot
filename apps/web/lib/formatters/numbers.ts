/**
 * Centralized numbers and currency formatting
 */

export function formatNumber(
  value: number | null | undefined,
  locale = 'en',
): string {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US').format(value);
}

export function formatCurrency(
  amount: number | null | undefined,
  currency = 'EUR',
  locale = 'en',
): string {
  if (amount === null || amount === undefined) return '—';
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatPercent(
  value: number | null | undefined,
  locale = 'en',
): string {
  if (value === null || value === undefined) return '0%';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}
