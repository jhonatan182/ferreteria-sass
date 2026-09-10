import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { NON_NEGATIVE_MONEY_PATTERN } from '@ferreteria/validation';

/**
 * Cambio manual del costo promedio de un producto (docs/05 398-419, RP-025).
 *
 * Requiere `products.change_cost`. Motivo obligatorio. Audita el valor anterior
 * y el nuevo (`PRODUCT_COST_CHANGED`). NO genera movimiento de inventario ni
 * altera la existencia (docs/04 seccion 46): solo fija `InventoryBalance.averageCost`,
 * que en esta fase es la fuente de verdad del costo. Operacion de dominio, nunca
 * un PATCH libre del balance (MD-006).
 */
export class ChangeCostDto {
  @IsString()
  @Matches(NON_NEGATIVE_MONEY_PATTERN, { message: 'Costo invalido.' })
  averageCost!: string;

  @IsString()
  @MinLength(3, { message: 'El motivo del cambio de costo es obligatorio.' })
  @MaxLength(300)
  reason!: string;
}
