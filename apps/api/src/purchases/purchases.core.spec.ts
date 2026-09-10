import { computeWeightedAverage } from '../inventory/inventory.core.js';
import {
  computeItemAmounts,
  computePurchaseTotals,
  isNegative,
  isNonPositive,
} from './purchases.core.js';

/**
 * Pruebas de las reglas puras de compras. No tocan la base de datos.
 * El ejemplo canonico es el de docs/04 823-850 (cemento):
 *   producto en LIBRA, presentacion "bolsa 50 lb" (conversionFactor = 50)
 *   compra de 20 bolsas a L 250 c/u
 *   -> baseQuantity = 20 * 50 = 1000 lb
 *   -> unitBaseCost = 250 / 50 = L 5 / lb
 *   -> subtotal     = 20 * 250 = L 5000
 */

describe('computeItemAmounts', () => {
  it('presentacion: convierte a unidad base y a costo por unidad base (ejemplo cemento)', () => {
    expect(computeItemAmounts({ quantity: '20', conversionFactor: '50', unitCost: '250' })).toEqual(
      {
        baseQuantity: '1000.0000',
        unitBaseCost: '5.000000',
        subtotal: '5000.0000',
      },
    );
  });

  it('sin presentacion: conversionFactor = 1, unitCost ya es por unidad base', () => {
    expect(computeItemAmounts({ quantity: '12', conversionFactor: '1', unitCost: '3.5' })).toEqual({
      baseQuantity: '12.0000',
      unitBaseCost: '3.500000',
      subtotal: '42.0000',
    });
  });

  it('cantidades y costos decimales: aritmetica exacta', () => {
    expect(
      computeItemAmounts({ quantity: '2.5', conversionFactor: '1.5', unitCost: '9.99' }),
    ).toEqual({
      baseQuantity: '3.7500',
      unitBaseCost: '6.660000',
      subtotal: '24.9750',
    });
  });

  it('factor 0 o negativo no divide (defensivo)', () => {
    expect(
      computeItemAmounts({ quantity: '1', conversionFactor: '0', unitCost: '7' }).unitBaseCost,
    ).toBe('7.000000');
  });
});

describe('computePurchaseTotals', () => {
  it('subtotal = suma de lineas; total = subtotal - discount + tax', () => {
    expect(
      computePurchaseTotals({
        itemSubtotals: ['5000.0000', '42.0000'],
        discount: '100',
        tax: '755.10',
      }),
    ).toEqual({ subtotal: '5042.0000', total: '5697.1000' });
  });

  it('sin descuento ni impuesto, total = subtotal', () => {
    expect(
      computePurchaseTotals({ itemSubtotals: ['10', '20', '0.5'], discount: 0, tax: 0 }),
    ).toEqual({
      subtotal: '30.5000',
      total: '30.5000',
    });
  });

  it('multiples items decimales', () => {
    expect(
      computePurchaseTotals({
        itemSubtotals: ['24.9750', '3.7500', '0.0001'],
        discount: '0',
        tax: '0',
      }),
    ).toEqual({ subtotal: '28.7251', total: '28.7251' });
  });
});

describe('promedio ponderado tras una compra (reutiliza inventory.core)', () => {
  it('stock inicial 0 => averageCost = costo por unidad base de la compra', () => {
    // compra de 1000 lb a L 5 / lb sobre existencia 0
    expect(computeWeightedAverage('0', '0', '1000', '5')).toBe('5.000000');
  });

  it('promedia con la existencia previa por cantidades en unidad base', () => {
    // previo: 500 lb @ L 4 ; entra 1000 lb @ L 5 => (2000 + 5000) / 1500
    expect(computeWeightedAverage('500', '4', '1000', '5')).toBe('4.666667');
  });
});

describe('guardas', () => {
  it('isNonPositive', () => {
    expect(isNonPositive('0')).toBe(true);
    expect(isNonPositive('-1')).toBe(true);
    expect(isNonPositive('0.0001')).toBe(false);
  });
  it('isNegative', () => {
    expect(isNegative('-0.01')).toBe(true);
    expect(isNegative('0')).toBe(false);
  });
});
