import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Cancelacion de una compra completada (docs/05 589-627, RF-084, RP: `purchases.cancel`).
 * El motivo es OBLIGATORIO (docs/05 619, RN-076). Genera movimientos
 * compensatorios de inventario; no borra la compra (RN-030).
 */
export class CancelPurchaseDto {
  @IsString()
  @MinLength(3, { message: 'El motivo de la cancelacion es obligatorio.' })
  @MaxLength(500)
  reason!: string;
}
