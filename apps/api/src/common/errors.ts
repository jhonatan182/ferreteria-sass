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
  // --- Dominio: proveedores y compras (Fase 6) --------------------------
  SUPPLIER_NAME_TAKEN: 'SUPPLIER_NAME_TAKEN',
  /// El proveedor de la compra esta inactivo: no admite nuevas operaciones (RN-009 analogo).
  SUPPLIER_INACTIVE: 'SUPPLIER_INACTIVE',
  /// Se intento editar/completar una compra que ya no esta en DRAFT (RF-083).
  PURCHASE_NOT_DRAFT: 'PURCHASE_NOT_DRAFT',
  /// Se intento cancelar una compra que no esta COMPLETED (o ya fue cancelada).
  PURCHASE_NOT_COMPLETED: 'PURCHASE_NOT_COMPLETED',
  /// No se puede completar una compra sin items.
  PURCHASE_EMPTY: 'PURCHASE_EMPTY',
  /// Item de compra invalido: producto/presentacion inexistente, inactivo o de otro tenant.
  INVALID_PURCHASE_ITEM: 'INVALID_PURCHASE_ITEM',
  /// La reversion de la cancelacion dejaria la existencia negativa (docs/05 589-627).
  PURCHASE_CANCELLATION_STOCK_CONFLICT: 'PURCHASE_CANCELLATION_STOCK_CONFLICT',
  /// documentNumber de compra repetido en el tenant.
  PURCHASE_DOCUMENT_TAKEN: 'PURCHASE_DOCUMENT_TAKEN',
  // --- Dominio: clientes y ventas (Fase 7) ------------------------------
  /// Nombre de cliente repetido en el tenant.
  CUSTOMER_NAME_TAKEN: 'CUSTOMER_NAME_TAKEN',
  /// El cliente de la venta esta inactivo: no admite nuevas operaciones (RN-009 analogo).
  CUSTOMER_INACTIVE: 'CUSTOMER_INACTIVE',
  /// Operacion no permitida sobre el cliente general (desactivar, credito, editar su marca).
  GENERAL_CUSTOMER_PROTECTED: 'GENERAL_CUSTOMER_PROTECTED',
  /// Se intento editar/completar una venta que ya no esta en DRAFT (RF-101).
  SALE_NOT_DRAFT: 'SALE_NOT_DRAFT',
  /// Se intento cancelar una venta que no esta COMPLETED (o ya fue cancelada).
  SALE_NOT_COMPLETED: 'SALE_NOT_COMPLETED',
  /// No se puede completar una venta sin items.
  SALE_EMPTY: 'SALE_EMPTY',
  /// Item de venta invalido: producto/presentacion inexistente, inactivo o de otro tenant.
  INVALID_SALE_ITEM: 'INVALID_SALE_ITEM',
  /// documentNumber de venta repetido en el tenant.
  SALE_DOCUMENT_TAKEN: 'SALE_DOCUMENT_TAKEN',
  /// El pago enviado no cuadra con el total recalculado por el backend (regla V1: pago unico).
  SALE_PAYMENT_MISMATCH: 'SALE_PAYMENT_MISMATCH',
  /// Una venta CREDIT exige un cliente especifico; el cliente general no sirve (RF-092).
  CREDIT_REQUIRES_CUSTOMER: 'CREDIT_REQUIRES_CUSTOMER',
  /// `saldo + total` excederia el limite de credito del cliente (RF-112).
  CREDIT_LIMIT_EXCEEDED: 'CREDIT_LIMIT_EXCEEDED',
  /// Revertir el credito de la venta dejaria el saldo de la cuenta negativo.
  CREDIT_CANCELLATION_CONFLICT: 'CREDIT_CANCELLATION_CONFLICT',
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
