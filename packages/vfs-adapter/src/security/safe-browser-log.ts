const SENSITIVE_PATTERNS = [
  /password["':\s]*[^\s,"]+/gi,
  /passport["':\s]*[^\s,"]+/gi,
  /token["':\s]*[^\s,"]+/gi,
  /secret["':\s]*[^\s,"]+/gi,
  /cvv["':\s]*[^\s,"]+/gi,
  /card[_\s]?num(ber)?["':\s]*[^\s,"]+/gi,
  /otp["':\s]*[^\s,"]+/gi,
];

export function sanitizeLogMessage(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

export function logSafeBrowserEvent(event: string, meta?: Record<string, unknown>): void {
  const safeMeta: Record<string, unknown> = {};
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (
        /password|passport|cookie|token|secret|cvv|card|otp/i.test(key)
      ) {
        safeMeta[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        safeMeta[key] = sanitizeLogMessage(value);
      } else {
        safeMeta[key] = value;
      }
    }
  }
  // Machine-readable internal format
  console.log(`[VFS-BROWSER] ${sanitizeLogMessage(event)}`, safeMeta);
}
