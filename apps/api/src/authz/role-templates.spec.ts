import { PERMISSION_CODE_SET, PERMISSION_CODES } from './permissions.catalog.js';
import { SYSTEM_ROLE_TEMPLATES, SYSTEM_ROLE_TEMPLATE_LIST } from './role-templates.js';

describe('SYSTEM_ROLE_TEMPLATES', () => {
  it('define las 5 plantillas de roles de sistema', () => {
    expect(SYSTEM_ROLE_TEMPLATE_LIST.map((r) => r.name)).toEqual([
      'OWNER',
      'MANAGER',
      'CASHIER',
      'INVENTORY_MANAGER',
      'PURCHASES_MANAGER',
    ]);
  });

  it('todo permiso referenciado existe en el catalogo', () => {
    for (const tpl of SYSTEM_ROLE_TEMPLATE_LIST) {
      for (const code of tpl.permissions) {
        expect(PERMISSION_CODE_SET.has(code)).toBe(true);
      }
    }
  });

  it('ningun rol repite un permiso (RP-020)', () => {
    for (const tpl of SYSTEM_ROLE_TEMPLATE_LIST) {
      expect(new Set(tpl.permissions).size).toBe(tpl.permissions.length);
    }
  });

  it('OWNER cubre el catalogo completo (70)', () => {
    expect([...SYSTEM_ROLE_TEMPLATES.OWNER.permissions].toSorted()).toEqual(
      [...PERMISSION_CODES].toSorted(),
    );
  });

  it('CASHIER: exactamente los 10 de RP-014 y ninguno de los negados', () => {
    const cashier = new Set(SYSTEM_ROLE_TEMPLATES.CASHIER.permissions);
    expect(cashier.size).toBe(10);
    // docs/03 336-353 — no puede por defecto:
    for (const denied of [
      'products.change_cost',
      'products.change_price',
      'inventory.adjust',
      'sales.cancel',
      'sales.refund',
      'purchases.create',
      'purchases.cancel',
      'users.create',
      'users.update',
      'roles.manage_permissions',
    ]) {
      expect(cashier.has(denied)).toBe(false);
    }
  });

  it('INVENTORY_MANAGER: exactamente los 7 de RP-016 y ninguno de los negados', () => {
    const inv = new Set(SYSTEM_ROLE_TEMPLATES.INVENTORY_MANAGER.permissions);
    expect(inv.size).toBe(7);
    // docs/03 387-396 — no puede por defecto:
    for (const denied of [
      'sales.cancel',
      'sales.refund',
      'cash.close',
      'cash.expense',
      'users.create',
      'roles.manage_permissions',
    ]) {
      expect(inv.has(denied)).toBe(false);
    }
  });

  it('PURCHASES_MANAGER: exactamente los 8 de RP-018, sin purchases.cancel', () => {
    const pur = new Set(SYSTEM_ROLE_TEMPLATES.PURCHASES_MANAGER.permissions);
    expect(pur.size).toBe(8);
    expect(pur.has('purchases.cancel')).toBe(false);
    expect(pur.has('purchases.complete')).toBe(true);
  });

  it('MANAGER: sin administracion de usuarios, roles ni escritura de config', () => {
    const mgr = new Set(SYSTEM_ROLE_TEMPLATES.MANAGER.permissions);
    for (const denied of [
      'users.create',
      'users.update',
      'users.deactivate',
      'users.reset_access',
      'roles.create',
      'roles.update',
      'roles.delete',
      'roles.assign',
      'roles.manage_permissions',
      'tenant.settings.update',
    ]) {
      expect(mgr.has(denied)).toBe(false);
    }
    // conserva capacidades operativas
    for (const allowed of [
      'products.create',
      'inventory.adjust',
      'purchases.complete',
      'sales.create',
      'sales.cancel',
      'cash.close',
      'credits.collect',
      'reports.read',
    ]) {
      expect(mgr.has(allowed)).toBe(true);
    }
  });

  it('MANAGER es subconjunto propio de OWNER', () => {
    const owner = new Set(SYSTEM_ROLE_TEMPLATES.OWNER.permissions);
    const mgr = SYSTEM_ROLE_TEMPLATES.MANAGER.permissions;
    expect(mgr.every((c) => owner.has(c))).toBe(true);
    expect(mgr.length).toBeLessThan(owner.size);
  });
});
