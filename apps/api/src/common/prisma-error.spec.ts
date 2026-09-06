import { asPrismaKnownError, isUniqueViolation, uniqueTarget } from './prisma-error.js';

/**
 * La deteccion es ESTRUCTURAL, no por `instanceof`: con el generador
 * `prisma-client` + output propio, la clase importada no coincide con la que
 * lanza el runtime dentro de una transaccion interactiva. Ademas, el driver
 * adapter (pg) anida el nombre del indice en
 * `meta.driverAdapterError.cause.constraint.index`.
 */
const driverAdapterP2002 = (indexName: string): unknown => ({
  name: 'PrismaClientKnownRequestError',
  code: 'P2002',
  message: `Invalid prisma.product.create() ... data: { internalCode: "FER-000009" }`,
  meta: {
    driverAdapterError: {
      name: 'DriverAdapterError',
      cause: {
        kind: 'UniqueConstraintViolation',
        constraint: { index: indexName },
        table: 'products',
      },
    },
    modelName: 'Product',
  },
});

describe('prisma-error', () => {
  it('reconoce un P2002 por su forma, no por instanceof', () => {
    expect(isUniqueViolation(driverAdapterP2002('products_tenant_id_barcode_key'))).toBe(true);
    expect(isUniqueViolation(new Error('cualquier cosa'))).toBe(false);
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false);
  });

  it('asPrismaKnownError exige codigo con forma Pxxxx', () => {
    expect(asPrismaKnownError({ code: 'P2002' })).not.toBeNull();
    expect(asPrismaKnownError({ code: 'NOPE' })).toBeNull();
    expect(asPrismaKnownError(null)).toBeNull();
  });

  it('uniqueTarget expone el nombre del indice del driver adapter y NO el mensaje', () => {
    const target = uniqueTarget(driverAdapterP2002('products_tenant_id_barcode_key'));
    expect(target).toContain('products_tenant_id_barcode_key');
    // El `data` del mensaje trae "internalCode" aunque el indice violado sea el barcode.
    expect(target).not.toContain('internalCode');
  });

  it('distingue el indice de codigo interno del de barcode', () => {
    expect(uniqueTarget(driverAdapterP2002('products_tenant_id_internal_code_key'))).toContain(
      'internal_code',
    );
    expect(uniqueTarget(driverAdapterP2002('products_tenant_id_barcode_key'))).not.toContain(
      'internal_code',
    );
  });
});
