import enMessages from '../../messages/en.json';
import arMessages from '../../messages/ar.json';

export type KnownErrorCode = keyof typeof enMessages.errors;

export function getLocalizedErrorMessage(
  errorCodeOrMessage: string | undefined | null,
  locale = 'en',
): string {
  if (!errorCodeOrMessage) {
    return locale === 'ar'
      ? arMessages.errors.UNEXPECTED_ERROR
      : enMessages.errors.UNEXPECTED_ERROR;
  }

  const catalog = locale === 'ar' ? arMessages.errors : enMessages.errors;

  if (errorCodeOrMessage in catalog) {
    return catalog[errorCodeOrMessage as KnownErrorCode];
  }

  // Fallback: check if the string matches an unexpected message or return as is
  return errorCodeOrMessage;
}
