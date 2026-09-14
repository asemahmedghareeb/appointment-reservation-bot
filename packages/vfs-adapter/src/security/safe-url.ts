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
        if (parsed.origin === allowedParsed.origin) {
          return true;
        }
        // Allow localhost/127.0.0.1 on any port for test servers
        if (
          (allowedParsed.hostname === '127.0.0.1' || allowedParsed.hostname === 'localhost') &&
          parsed.hostname === allowedParsed.hostname
        ) {
          return true;
        }
        return false;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
