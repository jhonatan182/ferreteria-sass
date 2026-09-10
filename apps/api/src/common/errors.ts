import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Codigos funcionales estables de la API (AGENTS.md 26, docs/07 493-514).
 *
 * RF-180 exige diferenciar al menos: autenticacion, autorizacion, validacion,
 * recurso inexistente, conflicto, regla de negocio, limite del plan y feature
 * no disponible. Este catalogo cubre esas categorias para la fase de
 * autenticacion y contexto; las fases de dominio agregan los suyos.
 */
export const ERROR_CODES = {
  // --- Autenticacion (401) ---------------------------------------------------
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  // --- Autorizacion (403) --------------------------------------------------
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  NO_TENANT_ACCESS: 'NO_TENANT_ACCESS',
  TENANT_ACCESS_DENIED: 'TENANT_ACCESS_DENIED',
  MEMBERSHIP_INACTIVE: 'MEMBERSHIP_INACTIVE',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  SUBSCRIPTION_UNUSABLE: 'SUBSCRIPTION_UNUSABLE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  PLATFORM_ADMIN_REQUIRED: 'PLATFORM_ADMIN_REQUIRED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  // --- Conflicto / estado (409) ------------------------------------------
  TENANT_SELECTION_REQUIRED: 'TENANT_SELECTION_REQUIRED',
  PLAN_LIMIT_REACHED: 'PLAN_LIMIT_REACHED',
  // --- Dominio: productos y catalogos (Fase 4) --------------------------
  PRODUCT_CODE_TAKEN: 'PRODUCT_CODE_TAKEN',
  PRODUCT_BARCODE_TAKEN: 'PRODUCT_BARCODE_TAKEN',
  CATALOG_NAME_TAKEN: 'CATALOG_NAME_TAKEN',
  CATALOG_IN_USE: 'CATALOG_IN_USE',
  INVALID_PRESENTATION: 'INVALID_PRESENTATION',
  // --- Dominio: inventario (Fase 5) -------------------------------------
  /// Una salida o ajuste negativo dejaria stock < 0 (RN-022, RF-064).
  /// La validacion definitiva ocurre DENTRO de la transaccion (docs/07 348-368).
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  // --- Genericos ---------------------------------------------------------
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Excepcion de dominio con codigo funcional estable. El filtro global la
 * serializa como `{ code, message, details? }` (ver `@ferreteria/types` ApiError).
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

// --- Atajos para los casos de esta fase -------------------------------------

export class UnauthenticatedException extends AppException {
  constructor(message = 'Autenticacion requerida.', code: ErrorCode = ERROR_CODES.UNAUTHENTICATED) {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}

export class InvalidCredentialsException extends AppException {
  constructor() {
    super(
      ERROR_CODES.INVALID_CREDENTIALS,
      'Correo o contrasena incorrectos.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class ForbiddenException extends AppException {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, HttpStatus.FORBIDDEN, details);
  }
}

export class ConflictException extends AppException {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

/** Recurso inexistente o fuera del tenant activo (docs/07 493-514: 404). */
export class NotFoundException extends AppException {
  constructor(message = 'Recurso no encontrado.', details?: unknown) {
    super(ERROR_CODES.NOT_FOUND, message, HttpStatus.NOT_FOUND, details);
  }
}

/**
 * Regla de negocio no satisfecha (docs/07 493-514: 422). Distinto de
 * `VALIDATION_ERROR` (forma de la peticion) y de `ConflictException`
 * (colision de estado/concurrencia).
 */
export class BusinessRuleException extends AppException {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}
