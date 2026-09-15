import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import { locales, isValidLocale, type Locale } from '../../i18n/config';
import { AppProviders } from '../../providers/app-providers';
import '../globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-latin',
  display: 'swap',
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr
      ? 'لوحة التحكم | VisaFlow'
      : 'Dashboard | VisaFlow',
    description: isAr
      ? 'منصة إدارة وتتبع حجوزات التأشيرة الفورية — VisaFlow'
      : 'Mission-critical visa appointment operations console — VisaFlow',
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${notoSansArabic.variable}`}
    >
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
