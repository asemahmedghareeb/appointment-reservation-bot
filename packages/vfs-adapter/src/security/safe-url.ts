export function getSafeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return 'invalid-url';
  }
}

export function isOriginAllowed(urlStr: string, allowedOrigins: string[]): boolean {
  try {
    const parsed = new URL(urlStr);
    return allowedOrigins.some((allowed) => {
      try {
        const allowedParsed = new URL(allowed);
        return parsed.origin === allowedParsed.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
