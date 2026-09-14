import { CorrelationContextManager } from './correlation-context.js';

export const SENSITIVE_KEYS = new Set([
  'passport',
  'passportnumber',
  'passportnumberencrypted',
  'password',
  'passwordencrypted',
  'cookie',
  'cookies',
  'authorization',
  'token',
  'storagestate',
  'storagestateencrypted',
  'cvv',
  'cardnumber',
  'otp',
  'secret',
  'solution',
  'privatekey',
  'clientsecret',
]);

export class SafePiiRedactor {
  static redact(target: unknown): unknown {
    if (target === null || target === undefined) {
      return target;
    }

    if (typeof target === 'string') {
      // Redact potential passport patterns or token patterns in loose strings
      return target
        .replace(/([a-zA-Z]{1,2}\d{6,9})/g, (match) => {
          if (match.length >= 7) {
            return `${match.slice(0, 2)}****${match.slice(-2)}`;
          }
          return match;
        })
        .replace(/(Bearer\s+)[a-zA-Z0-9._-]+/gi, '$1[REDACTED_TOKEN]')
        .replace(/(password=)[^&\s]+/gi, '$1[REDACTED_PASSWORD]');
    }

    if (typeof target !== 'object') {
      return target;
    }

    if (Array.isArray(target)) {
      return target.map((item) => this.redact(item));
    }

    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey) || /password|passport|secret|cookie|token|cvv/i.test(lowerKey)) {
        output[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        output[key] = this.redact(value);
      } else if (typeof value === 'string') {
        output[key] = this.redact(value);
      } else {
        output[key] = value;
      }
    }

    return output;
  }

  static serializeError(err: unknown): Record<string, unknown> {
    if (!err) {
      return { message: 'Empty error' };
    }

    if (err instanceof Error) {
      return {
        name: err.name,
        message: this.redact(err.message),
        stack: err.stack ? this.redact(err.stack) : undefined,
      };
    }

    return {
      message: this.redact(String(err)),
    };
  }
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  service: string;
  operation?: string | undefined;
  caseId?: string | undefined;
  workerId?: string | undefined;
  provider?: string | undefined;
  correlationId: string;
  message: string;
  details?: unknown;
}

export class SafeLogger {
  constructor(private readonly serviceName = 'worker') {}

  private log(level: LogLevel, message: string, details?: unknown) {
    const ctx = CorrelationContextManager.get();
    const redactedDetails = details ? SafePiiRedactor.redact(details) : undefined;
    const sanitizedMessage = String(SafePiiRedactor.redact(message));

    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      operation: ctx?.operation,
      caseId: ctx?.caseId,
      workerId: ctx?.workerId,
      provider: ctx?.provider,
      correlationId: ctx?.correlationId || 'system',
      message: sanitizedMessage,
      ...(redactedDetails !== undefined ? { details: redactedDetails } : {}),
    };

    const serialized = JSON.stringify(logEntry);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  debug(message: string, details?: unknown) {
    this.log('debug', message, details);
  }

  info(message: string, details?: unknown) {
    this.log('info', message, details);
  }

  warn(message: string, details?: unknown) {
    this.log('warn', message, details);
  }

  error(message: string, err?: unknown) {
    const errorDetails = err ? SafePiiRedactor.serializeError(err) : undefined;
    this.log('error', message, errorDetails);
  }
}

export const workerLogger = new SafeLogger('worker');
