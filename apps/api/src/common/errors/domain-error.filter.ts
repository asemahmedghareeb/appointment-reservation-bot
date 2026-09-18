import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from './domain-error.js';
import type { ApiErrorResponse } from '@visaflow/shared-types';

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Handle DomainError (both instanceof and duck-typed)
    const isDomainError =
      exception instanceof DomainError ||
      (typeof exception === 'object' &&
        exception !== null &&
        'code' in exception &&
        'httpStatus' in exception);

    if (isDomainError) {
      const err = exception as any;
      const errorBody: ApiErrorResponse = {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      };
      response.status(err.httpStatus || 400).json(errorBody);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      let message = exception.message;
      let details: Record<string, unknown> | undefined;

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (Array.isArray(resObj['message'])) {
          message = 'Validation failed';
          details = { validationErrors: resObj['message'] };
        } else if (typeof resObj['message'] === 'string') {
          message = resObj['message'];
        }
      }

      const errorBody: ApiErrorResponse = {
        error: {
          code: status === 400 ? 'VALIDATION_FAILED' : 'HTTP_ERROR',
          message,
          ...(details ? { details } : {}),
        },
      };

      response.status(status).json(errorBody);
      return;
    }

    // Unhandled internal server error
    const message = exception instanceof Error ? exception.message : 'Internal server error';
    console.error('[Unhandled Exception]:', message, exception instanceof Error ? exception.stack : exception);

    const isDev = process.env.NODE_ENV !== 'production';
    const errorBody: ApiErrorResponse = {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: isDev ? message : 'An unexpected internal error occurred.',
        ...(isDev && exception instanceof Error ? { details: { stack: exception.stack } } : {}),
      },
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorBody);
  }
}
