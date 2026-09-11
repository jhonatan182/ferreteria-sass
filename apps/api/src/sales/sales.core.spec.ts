import { computeWeightedAverage } from '../inventory/inventory.core.js';
import {
  capturedUnitCost,
  computeSaleItemAmounts,
  computeSaleTotals,
  isNegative,
  isNonPositive,
  moneyEquals,
} from './sales.core.js';

/**
 * Pruebas de las reglas puras de ventas. No tocan la base de datos.
 * El ejemplo canonico es el del prompt de la Fase 7 (cemento):
 *   producto en LIBRA, presentacion "Bolsa 50 lb" (conversionFactor = 50)
 *   venta de 3 bolsas a L 250 c/u
 *   -> baseQuantity = 3 * 50 = 150 lb
 *   -> subtotal     = 3 * 250 = L 750
 */

describe('computeSaleItemAmounts', () => {
  it('presentacion: convierte a unidad base y calcula el subtotal (ejemplo cemento)', () => {
    expect(
      computeSaleItemAmounts({ quantity: '3', conversionFactor: '50', unitPrice: '250' }),
    ).toEqual({
      baseQuantity: '150.0000',
      subtotal: '750.0000',
    });
  });

  it('sin presentacion explicita: conversionFactor = 1 (unidad base)', () => {
    expect(
      computeSaleItemAmounts({ quantity: '12', conversionFactor: '1', unitPrice: '3.5' }),
    ).toEqual({ baseQuantity: '12.0000', subtotal: '42.0000' });
  });

  it('cantidades y precios decimales: aritmetica exacta', () => {
    expect(
      computeSaleItemAmounts({ quantity: '2.5', conversionFactor: '1.5', unitPrice: '9.99' }),
    ).toEqual({ baseQuantity: '3.7500', subtotal: '24.9750' });
  });

  it('descuento de linea (en V1 siempre 0, pero la funcion lo admite)', () => {
    expect(
      computeSaleItemAmounts({
        quantity: '2',
        conversionFactor: '1',
        unitPrice: '10',
        discount: '3',
      }).subtotal,
    ).toBe('17.0000');
  });
});

describe('capturedUnitCost', () => {
  it('costo por unidad base * factor = costo de una presentacion completa', () => {
    // averageCost = L 5 / lb ; bolsa de 50 lb -> L 250 por bolsa
    expect(capturedUnitCost('5', '50')).toBe('250.000000');
  });

  it('sin presentacion (factor 1): el costo capturado es el mismo por unidad base', () => {
    expect(capturedUnitCost('3.5', '1')).toBe('3.500000');
  });
});

describe('computeSaleTotals', () => {
  it('subtotal = suma de lineas; total = subtotal - discount + tax', () => {
    expect(
      computeSaleTotals({ itemSubtotals: ['750.0000', '42.0000'], discount: '50', tax: '95.04' }),
    ).toEqual({ subtotal: '792.0000', total: '837.0400' });
  });

  it('sin descuento ni impuesto, total = subtotal', () => {
    expect(computeSaleTotals({ itemSubtotals: ['10', '20', '0.5'], discount: 0, tax: 0 })).toEqual(
      { subtotal: '30.5000', total: '30.5000' },
    );
  });

  it('multiples items decimales', () => {
    expect(
      computeSaleTotals({
        itemSubtotals: ['24.9750', '3.7500', '0.0001'],
        discount: '0',
        tax: '0',
      }),
    ).toEqual({ subtotal: '28.7251', total: '28.7251' });
  });
});

describe('promedio ponderado tras una venta (reutiliza inventory.core, no lo altera)', () => {
  it('una salida NO recibe unitCost: el promedio permanece igual', () => {
    // El promedio solo cambia con entradas con costo propio (compras/reversos de venta
    // no lo tocan). Se documenta aqui que sales.core no reimplementa esta regla.
    expect(computeWeightedAverage('100', '5', '0', '0')).toBe('5.000000');
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

  it('moneyEquals compara con la escala del sistema (4 decimales)', () => {
    expect(moneyEquals('10', '10.0000')).toBe(true);
    expect(moneyEquals('10.00001', '10')).toBe(true); // redondea a 4 decimales
    expect(moneyEquals('10.01', '10')).toBe(false);
  });
});
