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

    if (exception instanceof DomainError) {
      const errorBody: ApiErrorResponse = {
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details ? { details: exception.details } : {}),
        },
      };
      response.status(exception.httpStatus).json(errorBody);
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
    console.error('[Unhandled Exception]:', message);

    const errorBody: ApiErrorResponse = {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred.',
      },
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorBody);
  }
}
