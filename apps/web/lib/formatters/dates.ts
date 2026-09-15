export function formatRelativeTime(
  dateInput: string | Date | number,
  locale = 'en',
): string {
  const date =
    typeof dateInput === 'string' || typeof dateInput === 'number'
      ? new Date(dateInput)
      : dateInput;
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));

  const isAr = locale === 'ar';

  if (diffSeconds < 60) {
    return isAr ? `منذ ${diffSeconds} ثانية` : `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return isAr ? `منذ ${diffMinutes} دقيقة` : `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return isAr ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
}

export function formatAgeSeconds(seconds: number, locale = 'en'): string {
  const isAr = locale === 'ar';
  if (seconds < 60) {
    return isAr ? `${seconds}ث` : `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (minutes < 60) {
    return isAr ? `${minutes}د ${remSec}ث` : `${minutes}m ${remSec}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return isAr ? `${hours}س ${remMin}د` : `${hours}h ${remMin}m`;
}

export function formatDate(
  dateInput: string | Date | null | undefined,
  locale = 'en',
): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const intlLocale = locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
  return date.toLocaleDateString(intlLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(
  dateInput: string | Date | null | undefined,
  locale = 'en',
): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const intlLocale = locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
  return date.toLocaleString(intlLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
