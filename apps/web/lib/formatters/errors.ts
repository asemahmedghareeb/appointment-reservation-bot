import enMessages from '../../messages/en.json';
import arMessages from '../../messages/ar.json';
import { BookingCaseStatus } from '@visaflow/shared-types';

export type KnownErrorCode = keyof typeof enMessages.errors;

export function getLocalizedErrorMessage(
  errorCodeOrMessage: string | undefined | null,
  locale = 'en',
): string {
  const fallback =
    locale === 'ar'
      ? arMessages.errors.UNEXPECTED_ERROR
      : enMessages.errors.UNEXPECTED_ERROR;

  if (!errorCodeOrMessage) {
    return fallback;
  }

  const catalog = locale === 'ar' ? arMessages.errors : enMessages.errors;

  if (errorCodeOrMessage in catalog) {
    return catalog[errorCodeOrMessage as KnownErrorCode];
  }

  // Fallback to localized unexpected error rather than raw code / stack
  return fallback;
}

export function getStatusLabel(status: BookingCaseStatus | string, locale = 'en'): string {
  if (locale === 'ar') {
    const arLabel = (arMessages.statuses as Record<string, string>)[status];
    if (arLabel) return arLabel;
  }
  const enLabel = (enMessages.statuses as Record<string, string>)[status];
  return enLabel || String(status);
}
