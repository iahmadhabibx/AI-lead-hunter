import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Logger } from '@aijh/observability';
import type { Response } from 'express';
import { ZodError } from 'zod';
import type { RequestWithId } from './request-id.middleware';
import { AppHttpException } from './app-http.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithId>();
    const requestId = req.requestId;

    if (exception instanceof ZodError) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: exception.issues,
          requestId,
        },
      });
      return;
    }

    if (exception instanceof AppHttpException) {
      res.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          requestId,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);
      res.status(status).json({
        error: {
          code: status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR',
          message: Array.isArray(message) ? message.join(', ') : message,
          requestId,
        },
      });
      return;
    }

    this.logger.error({ err: exception, requestId }, 'Unhandled exception');
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId,
      },
    });
  }
}
