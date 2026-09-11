import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { NON_NEGATIVE_MONEY_PATTERN } from '@ferreteria/validation';

import { PAYMENT_METHODS, type PaymentMethodValue } from '../sales.constants.js';

/**
 * Finalizacion de una venta (`POST /sales/:id/complete`, permiso `sales.create`
 * — docs/05 900-910). El pago viaja aqui: en V1 una venta usa UN metodo.
 *
 * `amount` es opcional; si se envia debe cuadrar EXACTO con el total recalculado
 * por el backend (regla del caso de uso V1: pago unico — `SALE_PAYMENT_MISMATCH`
 * si no cuadra). Si se omite, se usa el total. El modelo (`SalePayment`
 * separado) admite varios pagos en el futuro sin cambiar esta ruta.
 *
 * `CREDIT` exige la feature `CREDITS`, un cliente especifico (no el general) y
 * que `saldo + total <= creditLimit` (RF-106 / RF-112).
 */
export class CompleteSaleDto {
  @IsIn(PAYMENT_METHODS, { message: 'Metodo de pago invalido.' })
  method!: PaymentMethodValue;

  /** Referencia manual del pago (voucher de tarjeta, referencia de transferencia). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, { message: 'Monto de pago invalido.' })
  amount?: string;
}
