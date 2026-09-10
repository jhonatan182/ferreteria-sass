import { IsIn, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { QUANTITY_PATTERN } from '@ferreteria/validation';

/**
 * Ajuste manual de inventario (docs/05 626-681, RN-023, RP-024).
 *
 * Se expresa como DIFERENCIA (`direction` + `quantity`), nunca como "stock = N"
 * (RN-024, docs/04 1274). `quantity` es la magnitud en la UNIDAD BASE del
 * producto y viaja como cadena decimal (AGENTS.md 11-12). El `motivo` es
 * OBLIGATORIO (RN-023). El backend revalida que el producto pertenece al tenant
 * y que la salida no deja stock negativo dentro de la transaccion.
 */
export class CreateAdjustmentDto {
  @IsUUID('4', { message: 'productId invalido.' })
  productId!: string;

  /** `IN` suma existencia, `OUT` la resta. */
  @IsIn(['IN', 'OUT'], { message: 'La direccion debe ser IN u OUT.' })
  direction!: 'IN' | 'OUT';

  @IsString()
  @Matches(QUANTITY_PATTERN, { message: 'Cantidad decimal invalida.' })
  quantity!: string;

  @IsString()
  @MinLength(3, { message: 'El motivo del ajuste es obligatorio.' })
  @MaxLength(300)
  reason!: string;
}
