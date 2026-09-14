import { DomainErrorCode } from './domain-error-codes.js';

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: DomainErrorCode,
    message: string,
    httpStatus = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.httpStatus = httpStatus;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
