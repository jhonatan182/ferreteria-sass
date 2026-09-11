import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Cancelacion de una venta completada (`POST /sales/:id/cancel`, permiso
 * `sales.cancel` — RP-022). El motivo es OBLIGATORIO (RN-076, RN-078). Genera
 * movimientos compensatorios de inventario (y de credito si aplica); no borra la
 * venta (RN-035).
 */
export class CancelSaleDto {
  @IsString()
  @MinLength(3, { message: 'El motivo de la cancelacion es obligatorio.' })
  @MaxLength(500)
  reason!: string;
}
