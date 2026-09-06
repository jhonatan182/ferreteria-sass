# Roles y Permisos — Sistema SaaS para Ferreterías

**Versión:** 1.0  
**Estado:** Propuesto para aprobación  
**Última actualización:** 2026-09-05

---

# 1. Objetivo

Este documento define el modelo de autorización del sistema.

El sistema utilizará un modelo basado en:

```text
Usuario
   ↓
Membresía del Tenant
   ↓
Rol
   ↓
Permisos
```

Los permisos representan acciones concretas que un usuario puede ejecutar.

Los roles son agrupaciones de permisos destinadas a facilitar la administración.

---

# 2. Principios fundamentales

## RP-001 — Separación entre autenticación y autorización

Autenticación responde:

> ¿Quién eres?

Autorización responde:

> ¿Qué puedes hacer?

El sistema debe mantener ambos conceptos separados.

---

## RP-002 — Los permisos son la autoridad real

El sistema no debe determinar autorización exclusivamente mediante el nombre del rol.

Incorrecto:

```text
if role === "ADMIN"
```

Correcto:

```text
if user has permission "products.update"
```

---

## RP-003 — Los roles agrupan permisos

Un rol representa un conjunto de permisos.

Ejemplo:

```text
ROL: VENDEDOR

Permisos:
- products.read
- customers.read
- customers.create
- sales.read
- sales.create
```

---

## RP-004 — Permisos en backend

Todas las operaciones protegidas deben validarse en el backend.

Las restricciones de la interfaz únicamente mejoran la experiencia del usuario.

Nunca constituyen un mecanismo de seguridad.

---

## RP-005 — Principio de mínimo privilegio

Un usuario debe recibir únicamente los permisos necesarios para realizar sus funciones.

No se debe conceder acceso administrativo por defecto.

---

# 3. Contexto de plataforma y tenant

El sistema tendrá dos niveles de autorización:

```text
PLATAFORMA
    ↓
Platform Admin

TENANT
    ↓
Tenant Owner
Tenant Manager
Vendedor
Inventario
Compras
etc.
```

---

# 4. Platform Admin

## RP-006 — Concepto

El Platform Admin administra la plataforma SaaS completa.

No pertenece funcionalmente a una ferretería específica.

Tiene acceso a:

- Tenants
- Planes
- Suscripciones
- Pagos
- Configuración de plataforma
- Auditoría de plataforma

---

## RP-007 — Responsabilidades

El Platform Admin puede:

- Crear tenants
- Activar o desactivar tenants
- Asignar planes
- Crear suscripciones
- Registrar pagos
- Renovar suscripciones
- Suspender suscripciones
- Reactivar suscripciones
- Administrar planes
- Administrar features
- Administrar límites
- Consultar auditoría de plataforma

---

## RP-008 — Acceso a datos del tenant

El Platform Admin no debe tener acceso automático a las operaciones internas de un tenant.

Si en el futuro se requiere soporte o acceso administrativo a un tenant, deberá existir un mecanismo explícito, temporal y auditable.

No se debe implementar una puerta trasera.

---

# 5. Roles del tenant

Se definirán inicialmente los siguientes roles predefinidos:

```text
OWNER
MANAGER
CASHIER
INVENTORY_MANAGER
PURCHASES_MANAGER
```

Estos roles constituyen valores iniciales.

El sistema debe permitir posteriormente crear roles personalizados.

---

# 6. Tenant Owner

## RP-009 — Propósito

Representa al propietario o responsable principal de la ferretería.

Tiene acceso administrativo y operativo.

---

## RP-010 — Capacidades

El Owner puede:

### Administración

- Administrar usuarios
- Administrar roles
- Asignar permisos
- Administrar configuración del negocio

### Productos

- Crear productos
- Editar productos
- Activar/desactivar productos
- Administrar unidades
- Administrar presentaciones
- Modificar precios
- Modificar costos cuando corresponda

### Inventario

- Consultar inventario
- Consultar kardex
- Realizar ajustes
- Consultar movimientos

### Compras

- Crear compras
- Completar compras
- Cancelar compras
- Administrar proveedores

### Ventas

- Crear ventas
- Cancelar ventas
- Procesar devoluciones
- Consultar ventas

### Clientes

- Crear
- Editar
- Consultar

### Créditos

- Consultar cuentas
- Registrar abonos
- Ajustar créditos cuando esté autorizado

### Caja

- Abrir caja
- Registrar movimientos
- Realizar gastos
- Cerrar caja
- Consultar cierres

### Reportes

- Consultar todos los reportes disponibles para el tenant

---

# 7. Tenant Manager

## RP-011 — Propósito

Representa a un administrador operativo o encargado general de la ferretería.

Tiene amplias capacidades operativas, pero puede tener restricciones sobre la administración estructural del tenant.

---

## RP-012 — Capacidades

Puede administrar:

- Productos
- Inventario
- Compras
- Ventas
- Clientes
- Proveedores
- Créditos
- Caja
- Reportes

Por defecto no puede:

- Administrar el tenant
- Cambiar la propiedad del tenant
- Administrar suscripciones
- Administrar configuración SaaS
- Modificar permisos críticos de otros usuarios

El Owner podrá asignarle permisos adicionales si el sistema lo permite.

---

# 8. Cashier / Vendedor-Cajero

## RP-013 — Propósito

Usuario dedicado principalmente a ventas y operaciones de caja.

---

## RP-014 — Permisos iniciales

Puede:

```text
products.read

customers.read
customers.create

sales.read
sales.create

credits.read
credits.collect

cash.open
cash.read
cash.close
```

Puede consultar los datos necesarios para realizar una venta.

No puede por defecto:

```text
products.delete
products.change_cost
products.change_price

inventory.adjust

sales.cancel
sales.refund

purchases.create
purchases.cancel

users.create
users.update

roles.manage
```

Las acciones críticas pueden ser habilitadas explícitamente mediante permisos.

---

# 9. Inventory Manager

## RP-015 — Propósito

Usuario responsable de inventario y productos.

---

## RP-016 — Permisos iniciales

Puede:

```text
products.read
products.create
products.update

inventory.read
inventory.adjust
inventory.kardex

purchases.read
```

Puede administrar información operativa de inventario.

No puede por defecto:

```text
sales.cancel
sales.refund

cash.close
cash.expense

users.create
roles.manage
```

---

# 10. Purchases Manager

## RP-017 — Propósito

Usuario responsable de compras y proveedores.

---

## RP-018 — Permisos iniciales

Puede:

```text
products.read

suppliers.read
suppliers.create
suppliers.update

purchases.read
purchases.create
purchases.update
purchases.complete
```

La cancelación de compras puede requerir un permiso adicional:

```text
purchases.cancel
```

---

# 11. Roles personalizados

## RP-019 — Personalización

El Owner podrá crear roles personalizados.

Ejemplo:

```text
ROL: SUPERVISOR

Permisos:
- products.read
- sales.read
- sales.cancel
- inventory.read
- inventory.adjust
- reports.read
```

---

## RP-020 — No duplicar permisos

Un rol no debe contener el mismo permiso más de una vez.

---

## RP-021 — Roles del sistema

Los roles predefinidos pueden considerarse roles del sistema.

El sistema debe impedir modificaciones peligrosas sobre roles protegidos cuando dichas modificaciones puedan provocar pérdida de acceso administrativo.

---

# 12. Catálogo de permisos

Los permisos se organizarán por módulo.

---

# 13. Productos

```text
products.read
products.create
products.update
products.activate
products.deactivate
products.manage_units
products.manage_presentations
products.change_price
products.change_cost
```

---

# 14. Inventario

```text
inventory.read
inventory.kardex
inventory.adjust
inventory.adjust_approve
inventory.export
```

La separación entre `adjust` y `adjust_approve` permitirá implementar posteriormente un flujo de doble aprobación si el negocio lo necesita.

Inicialmente puede utilizarse únicamente `inventory.adjust`.

---

# 15. Compras

```text
purchases.read
purchases.create
purchases.update
purchases.complete
purchases.cancel
```

---

# 16. Ventas

```text
sales.read
sales.create
sales.cancel
sales.refund
sales.export
```

---

# 17. Clientes

```text
customers.read
customers.create
customers.update
customers.deactivate
```

---

# 18. Proveedores

```text
suppliers.read
suppliers.create
suppliers.update
suppliers.deactivate
```

---

# 19. Créditos

```text
credits.read
credits.create
credits.collect
credits.adjust
credits.change_limit
credits.export
```

---

# 20. Caja

```text
cash.read
cash.open
cash.close
cash.income
cash.expense
cash.withdraw
cash.adjust
cash.export
```

---

# 21. Reportes

```text
reports.read
reports.sales
reports.purchases
reports.inventory
reports.cash
reports.credits
reports.profit
reports.advanced
```

---

# 22. Usuarios

```text
users.read
users.create
users.update
users.activate
users.deactivate
users.reset_access
```

---

# 23. Roles

```text
roles.read
roles.create
roles.update
roles.delete
roles.assign
roles.manage_permissions
```

---

# 24. Configuración del tenant

```text
tenant.settings.read
tenant.settings.update
```

---

# 25. Auditoría

```text
audit.read
audit.export
```

---

# 26. Reglas para acciones críticas

Algunas acciones requieren especial protección.

## RP-022 — Cancelación de venta

Requiere:

```text
sales.cancel
```

Debe registrarse en auditoría.

---

## RP-023 — Devolución

Requiere:

```text
sales.refund
```

Debe registrarse:

- Usuario
- Venta original
- Productos
- Cantidades
- Monto
- Motivo

---

## RP-024 — Ajuste de inventario

Requiere:

```text
inventory.adjust
```

Debe registrar:

- Producto
- Cantidad anterior
- Cantidad ajustada
- Cantidad final
- Motivo
- Usuario
- Fecha

---

## RP-025 — Cambio de costo

Requiere:

```text
products.change_cost
```

Debe generar auditoría.

---

## RP-026 — Cambio de precio

Requiere:

```text
products.change_price
```

Debe generar auditoría.

---

## RP-027 — Cierre de caja

Requiere:

```text
cash.close
```

Una vez cerrado, el cierre no debe modificarse arbitrariamente.

---

## RP-028 — Administración de usuarios

Crear, desactivar o modificar usuarios requiere permisos correspondientes.

---

## RP-029 — Administración de roles

Modificar permisos de un rol requiere:

```text
roles.manage_permissions
```

---

# 27. Herencia de permisos

Inicialmente no se utilizará herencia entre roles.

Ejemplo:

```text
MANAGER
   ↓
no hereda automáticamente de OWNER
```

Cada rol tendrá su propio conjunto de permisos.

Esto mantiene el comportamiento simple y predecible.

---

# 28. Permisos efectivos

El backend determinará los permisos efectivos del usuario a partir de su membresía y rol.

Conceptualmente:

```text
User
  ↓
TenantMembership
  ↓
Role
  ↓
RolePermissions
  ↓
Permissions
```

---

# 29. Contexto del tenant

Antes de autorizar una operación, el backend debe verificar:

1. Usuario autenticado.
2. Usuario activo.
3. Membresía activa.
4. Tenant válido.
5. Suscripción válida para la operación.
6. Permiso requerido.
7. Propiedad del recurso respecto al tenant.

---

# 30. Tenant isolation

Tener el permiso correcto no significa que el usuario pueda acceder a cualquier registro.

Ejemplo:

```text
Usuario:
Tenant A

Permiso:
products.read
```

Solo puede consultar:

```text
Tenant A → Productos
```

Nunca:

```text
Tenant B → Productos
```

---

# 31. Suscripción y autorización

La suscripción constituye una capa adicional de autorización.

Conceptualmente:

```text
Autenticación
      ↓
Tenant
      ↓
Suscripción
      ↓
Feature / límite del plan
      ↓
Permiso
      ↓
Operación
```

Por ejemplo:

Un usuario puede tener:

```text
credits.create
```

pero si el plan del tenant no incluye la funcionalidad de créditos:

```text
CREDITS = false
```

la operación debe ser rechazada.

---

# 32. Features vs permisos

No deben confundirse:

### Feature

Determina si una funcionalidad está disponible para el tenant.

Ejemplo:

```text
CREDITS
ADVANCED_REPORTS
PAYROLL
```

### Permission

Determina si un usuario puede utilizar una acción dentro de esa funcionalidad.

Ejemplo:

```text
credits.read
credits.collect
credits.adjust
```

Por tanto:

```text
Feature habilitada
        +
Permiso autorizado
        =
Operación permitida
```

---

# 33. Límites del plan

Los límites también son independientes de los permisos.

Ejemplo:

```text
Plan:
BASIC

MAX_USERS = 2
```

Aunque el Owner tenga:

```text
users.create
```

no podrá crear un tercer usuario si el límite del plan no lo permite.

---

# 34. Seguridad

## RP-030 — Nunca confiar en el frontend

El frontend puede ocultar botones según permisos, pero el backend siempre debe validar.

---

## RP-031 — No aceptar permisos desde el cliente

El cliente nunca debe poder enviar algo como:

```text
permissions: ["roles.manage_permissions"]
```

y obtener autorización.

Los permisos deben determinarse en el servidor.

---

## RP-032 — No confiar únicamente en el rol

El backend debe comprobar permisos.

No debe asumir:

```text
MANAGER = puede hacer todo
```

---

## RP-033 — Denegación por defecto

Si un usuario no tiene explícitamente el permiso requerido, la operación debe ser rechazada.

---

# 35. Auditoría de autorización

Los cambios relevantes de autorización deben quedar registrados.

Ejemplos:

```text
Usuario creado
Usuario desactivado
Rol creado
Rol modificado
Permiso asignado
Permiso removido
Cambio de rol
```

---

# 36. Futuras extensiones

El modelo debe permitir posteriormente:

- Roles personalizados avanzados
- Múltiples roles por usuario
- Permisos temporales
- Aprobaciones
- Doble autorización para operaciones críticas
- Segregación de funciones
- Acceso por sucursal
- Restricciones por horario
- Restricciones por monto

Estas funcionalidades no forman parte de la primera versión salvo que se apruebe explícitamente.

---

# 37. Modelo conceptual final

El modelo de autorización inicial será:

```text
                    PLATFORM
                       │
                       ▼
                Platform Admin
                       │
              ┌────────┴────────┐
              ▼                 ▼
           Tenant A          Tenant B
              │                 │
         Memberships       Memberships
              │                 │
            Users             Users
              │                 │
            Roles             Roles
              │                 │
         Permissions       Permissions
```

---

# 38. Regla final

La autorización debe ser:

```text
Usuario autenticado
        ↓
¿Pertenece al tenant?
        ↓
¿Tenant activo?
        ↓
¿Suscripción permite la funcionalidad?
        ↓
¿Tiene el permiso?
        ↓
¿El recurso pertenece al tenant?
        ↓
PERMITIR
```

Si cualquiera de las validaciones falla:

```text
DENEGAR
```

El sistema debe aplicar esta regla en el backend.