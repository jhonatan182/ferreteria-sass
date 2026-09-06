import { PERMISSION_CATALOG, PERMISSION_CODES, PERMISSION_MODULES } from './permissions.catalog.js';

describe('PERMISSION_CATALOG', () => {
  it('tiene exactamente los 70 permisos de docs/03 475-636', () => {
    expect(PERMISSION_CATALOG).toHaveLength(70);
  });

  it('no repite codigos', () => {
    expect(new Set(PERMISSION_CODES).size).toBe(PERMISSION_CODES.length);
  });

  it('todos los codigos tienen formato modulo.accion en minusculas', () => {
    for (const code of PERMISSION_CODES) {
      expect(code).toMatch(/^[a-z]+(\.[a-z_]+)+$/);
    }
  });

  it('el modulo declarado es prefijo del codigo', () => {
    for (const { code, module } of PERMISSION_CATALOG) {
      expect(code.startsWith(`${module}.`)).toBe(true);
    }
  });

  it('todos los modulos declarados pertenecen a PERMISSION_MODULES', () => {
    const known = new Set<string>(PERMISSION_MODULES);
    for (const { module } of PERMISSION_CATALOG) {
      expect(known.has(module)).toBe(true);
    }
  });

  it('no incluye los codigos inconsistentes de la documentacion', () => {
    // roles.manage y products.delete se citan en docs/03 pero no existen
    // en el catalogo formal (ver cabecera de permissions.catalog.ts).
    expect(PERMISSION_CODES).not.toContain('roles.manage');
    expect(PERMISSION_CODES).not.toContain('products.delete');
  });

  it('cubre los modulos criticos esperados', () => {
    const modules = new Set(PERMISSION_CATALOG.map((p) => p.module));
    for (const m of PERMISSION_MODULES) {
      expect(modules.has(m)).toBe(true);
    }
  });
});
