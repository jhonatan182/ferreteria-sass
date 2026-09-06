import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiError } from '@ferreteria/types';

import { ERROR_CODES } from './errors.js';

/**
 * Filtro global: toda respuesta de error sale con la forma estable
 * `{ code, message, details? }` (AGENTS.md 26, docs/07 493-514).
 *
 * - `AppException` ya trae `code`.
 * - `ValidationPipe` lanza `BadRequestException` con `message: string[]`;
 *   se normaliza a `VALIDATION_ERROR`.
 * - Cualquier otra cosa es `INTERNAL_ERROR` 500 y no se filtra el detalle
 *   al cliente (docs/07 793: no exponer stack traces).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.describe(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status} ${body.code}`);
    }

    response.status(status).json(body);
  }

  private describe(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (this.isApiError(payload)) {
        return { status, body: payload };
      }

      // Forma de Nest: { statusCode, message, error } — message puede ser string[].
      const raw =
        typeof payload === 'string'
          ? { message: payload }
          : (payload as { message?: unknown; error?: unknown });
      const messages = Array.isArray(raw.message) ? raw.message : undefined;
      const message =
        status === HttpStatus.TOO_MANY_REQUESTS
          ? 'Demasiados intentos. Espera un momento e intenta de nuevo.'
          : (messages?.join('; ') ??
            (typeof raw.message === 'string' ? raw.message : exception.message));

      return {
        status,
        body: {
          code: this.fallbackCode(status),
          message,
          ...(messages ? { details: messages } : {}),
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Error interno del servidor.' },
    };
  }

  private fallbackCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.PERMISSION_DENIED;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.PLAN_LIMIT_REACHED;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMITED;
      default:
        return ERROR_CODES.INTERNAL_ERROR;
    }
  }

  private isApiError(value: unknown): value is ApiError {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as ApiError).code === 'string' &&
      typeof (value as ApiError).message === 'string'
    );
  }
}
