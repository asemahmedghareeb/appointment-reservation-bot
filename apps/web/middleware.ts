import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { LOCALE_COOKIE, isValidLocale, defaultLocale } from './i18n/config';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Root redirect with cookie persistence
  if (pathname === '/') {
    const customLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const targetLocale =
      customLocale && isValidLocale(customLocale) ? customLocale : defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${targetLocale}/dashboard`;
    const res = NextResponse.redirect(url);
    if (!request.cookies.has(LOCALE_COOKIE)) {
      res.cookies.set(LOCALE_COOKIE, targetLocale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  }

  // Run next-intl middleware
  const response = intlMiddleware(request);

  // Keep visaflow_locale cookie in sync with current locale segment
  const segments = pathname.split('/');
  const localeSegment = segments[1];
  if (localeSegment && isValidLocale(localeSegment)) {
    response.cookies.set(LOCALE_COOKIE, localeSegment, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
