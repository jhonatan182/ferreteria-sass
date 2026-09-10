import { AppException } from '../common/errors.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  computeWeightedAverage,
  recordMovementWithinTx,
  splitInOut,
  toBaseQuantity,
} from './inventory.core.js';

/**
 * Pruebas de las reglas puras de inventario (docs/07 292-406). No tocan la base
 * de datos: `recordMovementWithinTx` se ejerce con un `tx` en memoria para
 * verificar el sentido del signo, el saldo resultante y el rechazo de stock
 * negativo (RN-022 / RF-064). El bloqueo `FOR UPDATE` y el rollback reales se
 * cubren en `test/inventory.e2e-spec.ts`.
 */

describe('computeWeightedAverage (docs/07 383-404)', () => {
  it('stock anterior 0 => el nuevo costo es el costo de entrada', () => {
    expect(computeWeightedAverage(0, 0, 50, '12.5')).toBe('12.500000');
    expect(computeWeightedAverage(-3, 999, 10, '4')).toBe('4.000000');
  });

  it('promedia por cantidades y costos (ejemplo de docs/07: 10.6667)', () => {
    // 100 u * L.10 + 50 u * L.12 = 1600 ; 1600 / 150 = 10.666667
    expect(computeWeightedAverage(100, 10, 50, 12)).toBe('10.666667');
  });

  it('acepta decimales sin perder precision', () => {
    expect(computeWeightedAverage('1.5', '2', '0.5', '4')).toBe('2.500000');
  });
});

describe('toBaseQuantity (RN-013 / RN-014)', () => {
  it('convierte una presentacion a unidad base', () => {
    expect(toBaseQuantity(3, 50)).toBe('150.0000');
    expect(toBaseQuantity('1.5', '1')).toBe('1.5000');
    expect(toBaseQuantity('0.25', '4')).toBe('1.0000');
  });
});

describe('splitInOut', () => {
  it('separa entrada y salida segun el signo del baseQuantity', () => {
    expect(splitInOut('10')).toEqual({ entrada: '10', salida: '0' });
    expect(splitInOut('-4')).toEqual({ entrada: '0', salida: '4' });
    expect(splitInOut('-1.5')).toEqual({ entrada: '0', salida: '1.5' });
  });
});

/** `tx` minimo en memoria para ejercer `recordMovementWithinTx`. */
function fakeTx(startQty: string, startAvg: string) {
  const balance = { id: 'bal-1', quantity: startQty, average_cost: startAvg };
  const movements: Array<Record<string, unknown>> = [];
  const tx = {
    $executeRaw: async () => 1,
    $queryRaw: async () => [balance],
    inventoryBalance: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        if (typeof data.quantity === 'string') balance.quantity = data.quantity;
        if (typeof data.averageCost === 'string') balance.average_cost = data.averageCost;
        return balance;
      },
    },
    inventoryMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        movements.push(data);
        return { id: `mov-${movements.length}` };
      },
    },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, balance, movements };
}

describe('recordMovementWithinTx', () => {
  it('una entrada suma al saldo y registra previous/resulting', async () => {
    const { tx, balance, movements } = fakeTx('10', '0');
    const result = await recordMovementWithinTx(tx, {
      tenantId: 't1',
      productId: 'p1',
      type: 'ADJUSTMENT_IN',
      quantity: '5',
      unitId: 'u1',
      baseQuantityDelta: '5',
    });
    expect(result.previousQuantity).toBe('10');
    expect(result.resultingQuantity).toBe('15');
    expect(balance.quantity).toBe('15.0000');
    expect(movements[0].baseQuantity).toBe('5.0000');
  });

  it('una salida resta y guarda el baseQuantity negativo', async () => {
    const { tx, movements } = fakeTx('10', '0');
    const result = await recordMovementWithinTx(tx, {
      tenantId: 't1',
      productId: 'p1',
      type: 'ADJUSTMENT_OUT',
      quantity: '4',
      unitId: 'u1',
      baseQuantityDelta: '-4',
    });
    expect(result.resultingQuantity).toBe('6');
    expect(movements[0].baseQuantity).toBe('-4.0000');
  });

  it('rechaza una salida que dejaria stock negativo (INSUFFICIENT_STOCK)', async () => {
    const { tx, balance, movements } = fakeTx('5', '0');
    await expect(
      recordMovementWithinTx(tx, {
        tenantId: 't1',
        productId: 'p1',
        type: 'ADJUSTMENT_OUT',
        quantity: '8',
        unitId: 'u1',
        baseQuantityDelta: '-8',
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    // el balance no se toco y no se registro movimiento
    expect(balance.quantity).toBe('5');
    expect(movements).toHaveLength(0);
  });

  it('INSUFFICIENT_STOCK es una AppException 422', async () => {
    const { tx } = fakeTx('0', '0');
    const error = await recordMovementWithinTx(tx, {
      tenantId: 't1',
      productId: 'p1',
      type: 'ADJUSTMENT_OUT',
      quantity: '1',
      unitId: 'u1',
      baseQuantityDelta: '-1',
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppException);
    expect((error as AppException).getStatus()).toBe(422);
  });

  it('una entrada con costo recalcula el promedio ponderado', async () => {
    const { tx, balance } = fakeTx('100', '10');
    const result = await recordMovementWithinTx(tx, {
      tenantId: 't1',
      productId: 'p1',
      type: 'PURCHASE',
      quantity: '50',
      unitId: 'u1',
      baseQuantityDelta: '50',
      unitCost: '12',
    });
    expect(result.averageCost).toBe('10.666667');
    expect(balance.average_cost).toBe('10.666667');
  });

  it('un ajuste (sin unitCost) no cambia el averageCost', async () => {
    const { tx, balance } = fakeTx('100', '10');
    await recordMovementWithinTx(tx, {
      tenantId: 't1',
      productId: 'p1',
      type: 'ADJUSTMENT_IN',
      quantity: '20',
      unitId: 'u1',
      baseQuantityDelta: '20',
    });
    expect(balance.average_cost).toBe('10.000000');
  });
});
