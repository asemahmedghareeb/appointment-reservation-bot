'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '../../i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { Globe } from 'lucide-react';
import { LOCALE_COOKIE, type Locale } from '../../i18n/config';

export function LanguageSwitcher() {
  const currentLocale = useLocale() as Locale;
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const targetLocale: Locale = currentLocale === 'en' ? 'ar' : 'en';
  const label = currentLocale === 'en' ? 'العربية' : 'English';

  const handleSwitch = () => {
    // Persist cookie
    document.cookie = `${LOCALE_COOKIE}=${targetLocale}; path=/; max-age=31536000; SameSite=Lax`;

    // Preserve query string
    const query = searchParams.toString();
    const targetUrl = query ? `${pathname}?${query}` : pathname;

    // Navigate with target locale
    router.replace(targetUrl, { locale: targetLocale });
  };

  return (
    <button
      id="language-switcher-btn"
      type="button"
      onClick={handleSwitch}
      aria-label={`${t('switchLanguage')} (${label})`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid var(--border-subtle)',
        color: '#f8fafc',
        fontSize: '0.8125rem',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
      }}
    >
      <Globe size={15} style={{ color: '#3b82f6' }} />
      <span>{label}</span>
    </button>
  );
}
