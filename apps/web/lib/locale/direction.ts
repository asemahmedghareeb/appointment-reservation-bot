export type Direction = 'ltr' | 'rtl';

export function isRtl(locale: string): boolean {
  return locale === 'ar';
}

export function getDirection(locale: string): Direction {
  return isRtl(locale) ? 'rtl' : 'ltr';
}
