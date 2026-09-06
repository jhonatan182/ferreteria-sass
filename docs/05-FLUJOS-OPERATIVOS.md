# 05 — FLUJOS OPERATIVOS

**Proyecto:** Sistema SaaS para Ferreterías  
**Versión:** 1.0  
**Estado:** Propuesto para aprobación

---

# 1. Objetivo

Este documento define los flujos operativos principales del sistema.

Mientras `04-MODELO-DE-DOMINIO.md` define **qué entidades existen**, este documento define:

- qué puede hacer un usuario;
- qué validaciones deben ejecutarse;
- qué estados atraviesa una operación;
- qué información se crea o modifica;
- qué efectos produce una operación;
- qué operaciones deben ejecutarse dentro de una transacción;
- qué acciones requieren permisos especiales;
- qué operaciones generan movimientos de inventario, caja o crédito;
- qué operaciones deben quedar auditadas.

Los flujos descritos aquí constituyen la referencia funcional para la implementación posterior.

---

# 2. Principio general de los flujos

Toda operación importante deberá seguir este patrón:

```text
Usuario
   │
   ▼
Autenticación
   │
   ▼
Tenant Context
   │
   ▼
Permiso
   │
   ▼
Feature / Plan
   │
   ▼
Límite
   │
   ▼
Validaciones de negocio
   │
   ▼
Operación transaccional
   │
   ├── Entidad principal
   ├── Movimientos derivados
   └── Auditoría
```

La interfaz nunca será responsable de garantizar estas reglas.

Las validaciones críticas deberán ejecutarse en backend.

---

# 3. Estados y operaciones

Una regla general del sistema será:

```text
DRAFT
  │
  ▼
COMPLETED
  │
  ├── CANCELLED
  └── RETURN / COMPENSATING OPERATION
```

Una operación completada no deberá editarse libremente.

Las modificaciones que afecten inventario, dinero o saldos deberán realizarse mediante operaciones compensatorias.

---

# 4. Flujo: inicio de sesión

## Objetivo

Permitir que un usuario autenticado acceda a la plataforma.

## Flujo

```text
Usuario introduce credenciales
          │
          ▼
Backend valida identidad
          │
          ▼
Usuario activo?
      ┌───┴───┐
      │       │
     NO       SÍ
      │       │
   DENEGAR    ▼
        Buscar memberships
              │
              ▼
       ¿Tiene tenant activo?
          ┌───┴───┐
          │       │
         NO       SÍ
          │       │
       Denegar    ▼
             Establecer contexto
                    │
                    ▼
               Acceso permitido
```

Si el usuario pertenece a múltiples tenants, posteriormente podrá seleccionarse el tenant activo.

---

# 5. Flujo: selección de tenant

Un usuario puede pertenecer a uno o varios tenants.

## Flujo

```text
Login
 │
 ▼
Memberships disponibles
 │
 ├── 0 → DENEGAR
 │
 ├── 1 → seleccionar automáticamente
 │
 └── >1 → solicitar selección
```

El tenant seleccionado deberá validarse contra la membresía del usuario.

El frontend no podrá establecer arbitrariamente:

```text
tenantId = "otro-tenant"
```

para acceder a información.

---

# 6. Flujo: autorización de operación

Antes de ejecutar cualquier operación protegida:

```text
1. Usuario autenticado
2. Tenant válido
3. Membership activa
4. Subscription válida
5. Feature disponible
6. Límite disponible
7. Permission válida
8. Recurso pertenece al tenant
9. Regla de negocio válida
10. Ejecutar operación
```

El orden exacto podrá optimizarse técnicamente, pero todos los controles deberán existir cuando sean aplicables.

---

# 7. Flujo: creación de tenant

## Actor

Platform Admin.

## Objetivo

Registrar una nueva ferretería en la plataforma.

## Flujo

```text
Platform Admin
      │
      ▼
Crear Tenant
      │
      ▼
Crear usuario propietario
      │
      ▼
Crear membership OWNER
      │
      ▼
Asignar plan
      │
      ▼
Crear Subscription
      │
      ▼
Registrar auditoría
```

La creación deberá ser transaccional.

Si falla cualquiera de los pasos principales, no deberá quedar un tenant incompleto.

---

# 8. Flujo: configuración inicial del tenant

Después de crear el tenant se deberá configurar:

- información del negocio;
- categorías iniciales;
- marcas cuando corresponda;
- unidades;
- parámetros operativos;
- configuración de numeración;
- caja inicial cuando aplique.

El sistema deberá evitar obligar al usuario a configurar información innecesaria antes de poder realizar operaciones básicas.

---

# 9. Flujo: crear producto

## Actor

Usuario con:

```text
products.create
```

## Flujo

```text
Usuario
  │
  ▼
Abrir formulario
  │
  ▼
Introducir información
  │
  ├── Nombre
  ├── Código interno
  ├── Código de barras
  ├── Categoría
  ├── Marca
  ├── Unidad base
  └── Presentaciones
       │
       ▼
Validar información
       │
       ├── Código interno único
       ├── Barcode único si existe
       ├── Unidad válida
       └── Presentación válida
       │
       ▼
Crear Product
       │
       ▼
Crear Presentations
       │
       ▼
Crear InventoryBalance inicial = 0
       │
       ▼
AuditLog
```

Crear un producto no modifica inventario.

---

# 10. Flujo: generación de código interno

Si el usuario no proporciona código interno:

```text
Sistema
  │
  ▼
Obtener siguiente secuencia
  │
  ▼
Generar código
  │
  ▼
Validar unicidad
  │
  ▼
Asignar Product.internalCode
```

Ejemplo:

```text
FER-000001
FER-000002
FER-000003
```

La secuencia será independiente por tenant.

---

# 11. Flujo: agregar presentación de producto

## Ejemplo

Producto:

```text
Cemento
Unidad base: LIBRA
```

Presentación:

```text
Bolsa
Conversión: 50
Precio: L. 240
```

## Flujo

```text
Validar Product
      │
      ▼
Validar Unit
      │
      ▼
Validar conversionFactor > 0
      │
      ▼
Validar precio
      │
      ▼
Crear ProductPresentation
```

No modifica el inventario.

---

# 12. Flujo: modificar precio

## Permiso requerido

```text
products.change_price
```

## Flujo

```text
Usuario
  │
  ▼
Selecciona presentación
  │
  ▼
Introduce nuevo precio
  │
  ▼
Validar permiso
  │
  ▼
Actualizar precio
  │
  ▼
Registrar AuditLog
```

El cambio de precio no modifica ventas históricas.

Las ventas ya completadas conservan el precio utilizado en el momento de la operación.

---

# 13. Flujo: modificar costo

## Permiso requerido

```text
products.change_cost
```

Los cambios manuales de costo deberán estar restringidos.

El sistema deberá registrar:

- usuario;
- costo anterior;
- costo nuevo;
- producto;
- fecha;
- motivo.

El cambio de costo manual no debe modificar retroactivamente el costo de ventas anteriores.

---

# 14. Flujo: desactivar producto

## Permiso

```text
products.deactivate
```

## Flujo

```text
Validar producto
      │
      ▼
¿Tiene operaciones históricas?
      │
      ▼
Marcar INACTIVE
      │
      ▼
AuditLog
```

El producto no se elimina.

Un producto inactivo no deberá aparecer como opción normal para nuevas compras o ventas.

Su historial seguirá siendo consultable.

---

# 15. Flujo: compra en borrador

## Actor

Usuario con:

```text
purchases.create
```

## Flujo

```text
Crear Purchase
      │
      ▼
Estado = DRAFT
      │
      ▼
Agregar PurchaseItems
```

Durante este estado:

- no aumenta inventario;
- no modifica costo promedio;
- no modifica caja;
- no genera cuentas financieras;
- no genera movimientos definitivos.

---

# 16. Flujo: editar compra

Una compra `DRAFT` puede modificarse si el usuario posee:

```text
purchases.update
```

Se pueden:

- agregar productos;
- eliminar líneas;
- cambiar cantidades;
- cambiar costos;
- cambiar proveedor;
- cambiar información del documento.

Una compra `COMPLETED` no podrá modificarse mediante este flujo.

---

# 17. Flujo: completar compra

## Permiso

```text
purchases.complete
```

## Flujo

```text
Purchase DRAFT
      │
      ▼
Validar proveedor
      │
      ▼
Validar productos
      │
      ▼
Validar cantidades
      │
      ▼
Validar costos
      │
      ▼
Calcular totales
      │
      ▼
BEGIN TRANSACTION
      │
      ├── Marcar Purchase = COMPLETED
      │
      ├── Crear InventoryMovement(IN)
      │
      ├── Actualizar InventoryBalance
      │
      ├── Actualizar costo promedio
      │
      ├── Registrar pago/estado financiero
      │
      └── AuditLog
      │
      ▼
COMMIT
```

Si falla una operación:

```text
ROLLBACK
```

---

# 18. Flujo: compra pagada

Cuando la compra sea pagada inmediatamente:

```text
Purchase
   │
   └── Payment
```

Si el pago es en efectivo y el sistema administra salida física de caja:

```text
Purchase
   │
   └── CashMovement(EXPENSE)
```

El tratamiento exacto de cuentas por pagar se mantendrá fuera del núcleo de V1 mientras no exista un módulo formal de proveedores por pagar.

---

# 19. Flujo: cancelar compra

## Permiso

```text
purchases.cancel
```

Solo una compra completada podrá ser cancelada mediante este proceso.

## Flujo

```text
Purchase COMPLETED
        │
        ▼
Validar permiso
        │
        ▼
Validar que no esté cancelada
        │
        ▼
BEGIN TRANSACTION
        │
        ├── Crear movimiento inverso de inventario
        │
        ├── Recalcular inventario
        │
        ├── Recalcular costo según política definida
        │
        ├── Revertir efectos financieros aplicables
        │
        ├── Marcar Purchase = CANCELLED
        │
        └── AuditLog
        │
        ▼
COMMIT
```

La compra original permanece almacenada.

---

# 20. Flujo: ajuste de inventario

## Permiso

```text
inventory.adjust
```

Para ajustes que requieran aprobación:

```text
inventory.adjust_approve
```

## Flujo

```text
Usuario
  │
  ▼
Seleccionar producto
  │
  ▼
Indicar cantidad
  │
  ▼
Indicar dirección
  │
  ├── Entrada
  └── Salida
  │
  ▼
Indicar motivo
  │
  ▼
Validar permiso
  │
  ▼
Validar stock
  │
  ▼
Crear InventoryAdjustment
  │
  ▼
Crear InventoryMovement
  │
  ▼
Actualizar InventoryBalance
  │
  ▼
AuditLog
```

El motivo es obligatorio para ajustes.

---

# 21. Flujo: impedir inventario negativo

Antes de cualquier operación que reduzca inventario:

```text
stock actual >= cantidad requerida
```

Debe cumplirse.

Si:

```text
stock actual = 5
cantidad requerida = 8
```

la operación será rechazada.

No se permitirá:

```text
stock = -3
```

salvo que en una futura configuración del tenant se habilite explícitamente una política diferente.

La V1 utilizará inventario negativo deshabilitado.

---

# 22. Flujo: consultar kardex

## Permiso

```text
inventory.kardex
```

El usuario podrá consultar:

- producto;
- fecha;
- tipo de movimiento;
- entrada;
- salida;
- saldo;
- costo;
- usuario;
- documento origen.

Ejemplo:

```text
Fecha       Tipo       Entrada   Salida   Saldo
------------------------------------------------
01/09       COMPRA       100       0       100
02/09       VENTA          0      20        80
03/09       AJUSTE         5       0        85
```

Los movimientos históricos no deberán editarse desde el kardex.

---

# 23. Flujo: crear venta

## Permiso

```text
sales.create
```

## Flujo

```text
Crear Sale
   │
   ▼
Estado = DRAFT
   │
   ▼
Seleccionar cliente opcional
   │
   ▼
Agregar productos
   │
   ▼
Seleccionar presentación
   │
   ▼
Indicar cantidad
   │
   ▼
Obtener precio
   │
   ▼
Calcular línea
```

Todavía no se modifica:

- inventario;
- caja;
- crédito.

---

# 24. Flujo: validar venta

Antes de completar:

```text
Producto existe
Producto activo
Presentación válida
Cantidad > 0
Precio válido
Stock suficiente
Cliente válido cuando corresponda
Método de pago válido
```

Si el método es:

```text
CREDIT
```

además:

```text
Customer != null
CreditAccount disponible
Crédito permitido
Saldo + venta <= creditLimit
```

salvo que el usuario tenga permiso especial para exceder el límite.

---

# 25. Flujo: completar venta

## Permiso

```text
sales.create
```

## Flujo completo

```text
Sale DRAFT
    │
    ▼
Validar permisos
    │
    ▼
Validar productos
    │
    ▼
Validar stock
    │
    ▼
Validar cliente
    │
    ▼
Validar pago
    │
    ▼
Calcular totales
    │
    ▼
BEGIN TRANSACTION
    │
    ├── Marcar Sale = COMPLETED
    │
    ├── Crear SaleItems
    │
    ├── Crear InventoryMovement(OUT)
    │
    ├── Actualizar InventoryBalance
    │
    ├── Crear SalePayment
    │
    ├── Si CREDIT:
    │      └── Crear CreditMovement(SALE)
    │
    ├── Si CASH:
    │      └── Crear CashMovement(INCOME)
    │
    └── Crear AuditLog
    │
    ▼
COMMIT
```

Todos los efectos deberán pertenecer a la misma transacción.

---

# 26. Flujo: venta en efectivo

```text
Sale
 │
 ├── InventoryMovement(OUT)
 │
 ├── SalePayment(CASH)
 │
 └── CashMovement(INCOME)
```

El monto de efectivo recibido deberá quedar registrado.

Si existe cambio:

```text
cashReceived - saleTotal = change
```

El movimiento de caja deberá reflejar únicamente el ingreso neto correspondiente a la venta.

---

# 27. Flujo: venta con tarjeta

```text
Sale
 │
 ├── InventoryMovement(OUT)
 │
 └── SalePayment(CARD)
```

No se genera ingreso físico de efectivo.

La venta puede conservar una referencia de transacción si el negocio desea registrarla.

No habrá integración con el banco o proveedor de pagos en V1.

---

# 28. Flujo: venta por transferencia

```text
Sale
 │
 ├── InventoryMovement(OUT)
 │
 └── SalePayment(TRANSFER)
```

No genera ingreso físico de caja.

Puede registrarse una referencia manual:

```text
transferReference
```

---

# 29. Flujo: venta al crédito

## Requisitos

```text
Customer obligatorio
CreditAccount activa
Límite de crédito válido
Saldo disponible suficiente
```

## Flujo

```text
Sale
 │
 ├── InventoryMovement(OUT)
 │
 ├── SalePayment(CREDIT)
 │
 └── CreditMovement(SALE)
```

El saldo pendiente aumenta.

Ejemplo:

```text
Saldo anterior: L. 2,000
Venta crédito:  L. 1,500
------------------------
Nuevo saldo:    L. 3,500
```

---

# 30. Flujo: límite de crédito

Antes de completar una venta a crédito:

```text
availableCredit =
creditLimit - currentBalance
```

Debe cumplirse:

```text
saleTotal <= availableCredit
```

Ejemplo:

```text
Límite:          L. 10,000
Saldo actual:    L. 7,000
Disponible:      L. 3,000

Venta:           L. 3,500
```

Resultado:

```text
RECHAZADA
```

Un usuario con permiso especial podrá autorizar una excepción si el sistema posteriormente implementa ese mecanismo.

---

# 31. Flujo: registrar abono de crédito

## Permiso

```text
credits.collect
```

## Flujo

```text
Seleccionar cliente
       │
       ▼
Consultar CreditAccount
       │
       ▼
Indicar monto
       │
       ▼
Seleccionar método
       │
       ▼
Validar monto
       │
       ▼
BEGIN TRANSACTION
       │
       ├── Crear CreditMovement(PAYMENT)
       │
       ├── Si CASH:
       │      └── CashMovement(INCOME)
       │
       └── AuditLog
       │
       ▼
COMMIT
```

El abono nunca deberá superar el saldo pendiente sin una regla explícita para ello.

---

# 32. Flujo: estado del crédito

El estado se determina a partir de los movimientos.

```text
Saldo = 0
   │
   ▼
PAID
```

```text
Saldo > 0
y existen pagos
   │
   ▼
PARTIAL
```

```text
Saldo > 0
y no existen pagos
   │
   ▼
PENDING
```

El sistema deberá evitar inconsistencias entre el estado y los movimientos.

---

# 33. Flujo: ajuste de crédito

## Permiso

```text
credits.adjust
```

Los ajustes manuales requieren:

- motivo obligatorio;
- usuario responsable;
- monto;
- referencia;
- auditoría.

Nunca se deberá editar directamente el saldo.

En su lugar:

```text
CreditMovement(ADJUSTMENT)
```

---

# 34. Flujo: abrir caja

## Permiso

```text
cash.open
```

## Flujo

```text
Seleccionar CashRegister
        │
        ▼
Verificar que no exista sesión OPEN
        │
        ▼
Introducir fondo inicial
        │
        ▼
Crear CashSession
        │
        ├── status = OPEN
        ├── openingAmount
        └── openedBy
        │
        ▼
AuditLog
```

---

# 35. Flujo: registrar ingreso de caja

## Permiso

```text
cash.income
```

## Ejemplos

- ingreso adicional;
- abono en efectivo;
- otro ingreso autorizado.

## Flujo

```text
Validar CashSession OPEN
        │
        ▼
Indicar monto
        │
        ▼
Indicar motivo
        │
        ▼
Crear CashMovement(INCOME)
        │
        ▼
AuditLog
```

---

# 36. Flujo: registrar gasto de caja

## Permiso

```text
cash.expense
```

## Flujo

```text
Validar caja abierta
        │
        ▼
Indicar monto
        │
        ▼
Indicar motivo
        │
        ▼
Validar efectivo disponible
        │
        ▼
Crear CashMovement(EXPENSE)
        │
        ▼
AuditLog
```

---

# 37. Flujo: retiro de caja

## Permiso

```text
cash.withdraw
```

Un retiro representa una salida física de efectivo.

Debe registrar:

- monto;
- motivo;
- usuario;
- fecha;
- sesión;
- referencia cuando corresponda.

Se genera:

```text
CashMovement(WITHDRAWAL)
```

---

# 38. Flujo: cerrar caja

## Permiso

```text
cash.close
```

## Flujo

```text
CashSession OPEN
       │
       ▼
Calcular ingresos
       │
       ▼
Calcular egresos
       │
       ▼
Calcular esperado
       │
       ▼
Usuario cuenta efectivo
       │
       ▼
Registrar efectivo real
       │
       ▼
Calcular diferencia
       │
       ▼
BEGIN TRANSACTION
       │
       ├── Registrar cierre
       ├── Guardar expectedAmount
       ├── Guardar actualAmount
       ├── Guardar difference
       ├── Marcar CLOSED
       └── AuditLog
       │
       ▼
COMMIT
```

---

# 39. Fórmula de cierre

```text
expectedAmount =
    openingAmount
    + cashIncome
    - cashExpenses
    - cashWithdrawals
    - cashRefunds
```

Luego:

```text
difference =
    actualAmount - expectedAmount
```

Ejemplo:

```text
Fondo inicial:       L. 1,000
Ingresos:            L. 8,000
Gastos:              L. 500
Retiros:             L. 1,000
--------------------------------
Esperado:            L. 7,500

Efectivo contado:    L. 7,450

Diferencia:          L. -50
```

La diferencia deberá conservarse como información histórica.

---

# 40. Flujo: devolución de venta

## Permiso

```text
sales.refund
```

## Flujo

```text
Seleccionar venta
       │
       ▼
Validar venta COMPLETED
       │
       ▼
Seleccionar productos/cantidades
       │
       ▼
Validar cantidades devueltas
       │
       ▼
Crear devolución
       │
       ▼
BEGIN TRANSACTION
       │
       ├── Crear Return
       ├── Crear ReturnItems
       ├── InventoryMovement(IN)
       ├── Revertir efecto financiero correspondiente
       ├── CashMovement(OUT) cuando corresponda
       ├── Ajustar crédito cuando corresponda
       └── AuditLog
       │
       ▼
COMMIT
```

La venta original permanece intacta.

---

# 41. Flujo: devolución de una venta en efectivo

```text
Venta original
       │
       ▼
Devolución
       │
       ├── InventoryMovement(IN)
       │
       └── CashMovement(OUT)
```

El efectivo devuelto deberá quedar registrado.

---

# 42. Flujo: devolución de una venta a crédito

Una devolución de una venta a crédito deberá reducir la deuda correspondiente.

Conceptualmente:

```text
Sale
 │
 └── Return
       │
       ├── InventoryMovement(IN)
       │
       └── CreditMovement(ADJUSTMENT)
```

El ajuste deberá quedar relacionado con la devolución.

---

# 43. Flujo: cancelar venta

## Permiso

```text
sales.cancel
```

La cancelación deberá validar primero si la venta ya produjo:

- movimiento de inventario;
- movimiento de caja;
- movimiento de crédito.

Después deberá generar las operaciones inversas correspondientes.

```text
Sale COMPLETED
      │
      ▼
Validar posibilidad de cancelación
      │
      ▼
BEGIN TRANSACTION
      │
      ├── Revertir inventario
      ├── Revertir caja cuando corresponda
      ├── Revertir crédito cuando corresponda
      ├── Marcar Sale = CANCELLED
      └── AuditLog
      │
      ▼
COMMIT
```

Las reglas exactas de cancelación y devolución deberán distinguirse para evitar duplicar reversos.

---

# 44. Flujo: crear usuario

## Permiso

```text
users.create
```

## Flujo

```text
Tenant Admin
     │
     ▼
Crear usuario/invitación
     │
     ▼
Validar límite MAX_USERS
     │
     ▼
Crear User
     │
     ▼
Crear TenantMembership
     │
     ▼
Asignar Role
     │
     ▼
AuditLog
```

Si se alcanza el límite del plan:

```text
DENEGAR
```

salvo que el tenant cambie de plan.

---

# 45. Flujo: desactivar usuario

## Permiso

```text
users.deactivate
```

El usuario no se elimina si tiene historial.

Se marca como:

```text
INACTIVE
```

Un usuario inactivo:

- no puede iniciar operaciones nuevas;
- no puede autenticarse si la política de acceso así lo determina;
- conserva su historial.

---

# 46. Flujo: cambio de rol

## Permiso

```text
roles.assign
```

## Flujo

```text
Seleccionar usuario
       │
       ▼
Seleccionar rol
       │
       ▼
Validar que rol pertenezca al tenant
       │
       ▼
Actualizar membership
       │
       ▼
AuditLog
```

Los cambios de permisos deberán tener trazabilidad.

---

# 47. Flujo: gestión de roles

Los roles personalizados podrán implementarse posteriormente.

Para V1:

```text
OWNER
MANAGER
CASHIER
INVENTORY_MANAGER
PURCHASES_MANAGER
```

podrán crearse como roles iniciales.

Si se permite edición de permisos:

```text
roles.manage_permissions
```

será obligatorio.

No se deberá permitir accidentalmente que un usuario pueda asignarse a sí mismo permisos administrativos superiores.

---

# 48. Flujo: cambio de plan

## Actor

Platform Admin.

## Flujo

```text
Seleccionar Tenant
       │
       ▼
Seleccionar nuevo Plan
       │
       ▼
Validar plan
       │
       ▼
Actualizar Subscription
       │
       ▼
Registrar período
       │
       ▼
AuditLog
```

El cambio de plan no debe eliminar información existente.

---

# 49. Flujo: registrar pago SaaS

## Actor

Platform Admin.

## Flujo

```text
Seleccionar Tenant
       │
       ▼
Seleccionar Subscription
       │
       ▼
Registrar pago
       │
       ▼
Determinar período cubierto
       │
       ▼
Actualizar período de suscripción
       │
       ▼
Si estaba PAST_DUE/SUSPENDED:
       │
       └── Reactivar según reglas
       │
       ▼
PlatformAuditLog
```

No existe integración automática con un proveedor de pagos en V1.

---

# 50. Flujo: vencimiento de suscripción

El sistema deberá evaluar el estado de la suscripción.

Conceptualmente:

```text
ACTIVE
   │
   │ currentPeriodEnd alcanzado
   ▼
PAST_DUE
   │
   │ grace period agotado
   ▼
SUSPENDED
```

Durante `PAST_DUE` se permitirá el funcionamiento durante el período de gracia configurado.

Al llegar a `SUSPENDED`:

```text
Operaciones normales → BLOQUEADAS
Consultas esenciales → según política
Administración de suscripción → DISPONIBLE
Datos → CONSERVADOS
```

---

# 51. Flujo: tenant suspendido

Un tenant suspendido no debe perder sus datos.

La aplicación deberá impedir operaciones comerciales normales como:

- nuevas ventas;
- nuevas compras;
- ajustes de inventario;
- movimientos de caja;
- operaciones de crédito.

Deberá permitirse el acceso mínimo necesario para:

- visualizar el estado de la suscripción;
- consultar información necesaria;
- gestionar la reactivación.

La política exacta de acceso durante suspensión se definirá en los requerimientos funcionales.

---

# 52. Flujo: reactivar tenant

## Actor

Platform Admin inicialmente.

## Flujo

```text
Tenant SUSPENDED
       │
       ▼
Registrar pago
       │
       ▼
Extender período
       │
       ▼
Subscription = ACTIVE
       │
       ▼
Tenant vuelve a operar
       │
       ▼
PlatformAuditLog
```

No se deben restaurar datos porque los datos nunca fueron eliminados.

---

# 53. Flujo: límite de productos

Antes de crear un nuevo producto:

```text
currentProducts < MAX_PRODUCTS
```

Si:

```text
MAX_PRODUCTS = 500
currentProducts = 500
```

la creación será rechazada.

Los productos inactivos podrán o no contar contra el límite dependiendo de la política comercial final.

La recomendación inicial es que el límite represente productos activos.

---

# 54. Flujo: límite de usuarios

Antes de crear o activar un usuario:

```text
activeUsers < MAX_USERS
```

Los usuarios inactivos no deberán consumir una plaza activa del plan.

---

# 55. Flujo: consulta de reportes

Los reportes deberán respetar:

```text
Tenant
+
Permission
+
Feature
```

Ejemplo:

```text
reports.profit
```

requiere que:

1. el usuario tenga permiso;
2. el tenant tenga habilitada la funcionalidad correspondiente;
3. los datos consultados pertenezcan al tenant.

---

# 56. Flujo: auditoría

Las acciones críticas deberán generar auditoría dentro de la misma transacción que la operación.

Ejemplo:

```text
Completar venta
     │
     ├── Sale
     ├── InventoryMovement
     ├── SalePayment
     ├── CashMovement
     └── AuditLog
```

Si falla la transacción:

```text
ninguno de los registros deberá quedar confirmado.
```

Para determinadas acciones administrativas del SaaS:

```text
PlatformAuditLog
```

será utilizado en lugar de `AuditLog`.

---

# 57. Operaciones que requieren auditoría obligatoria

Como mínimo:

```text
Venta cancelada
Venta devuelta
Compra cancelada
Ajuste de inventario
Cambio de costo
Cambio de precio
Ajuste de crédito
Cierre de caja
Creación de usuario
Desactivación de usuario
Cambio de rol
Cambio de permisos
Cambio de plan
Suspensión de tenant
Reactivación de tenant
Registro de pago SaaS
```

---

# 58. Manejo de errores transaccionales

Si una operación genera múltiples efectos y uno falla:

```text
BEGIN
   operación A
   operación B
   operación C
   ERROR
ROLLBACK
```

No deberá existir:

```text
Venta creada
pero inventario no descontado
```

ni:

```text
Inventario descontado
pero venta no creada
```

ni:

```text
Crédito aumentado
pero venta no registrada
```

---

# 59. Concurrencia

El sistema deberá considerar operaciones simultáneas.

Ejemplo:

```text
Stock = 5

Usuario A intenta vender 4
Usuario B intenta vender 3
```

No basta con:

```text
SELECT stock
```

seguido posteriormente por:

```text
UPDATE stock
```

sin control transaccional.

La implementación deberá proteger las operaciones de inventario contra condiciones de carrera.

El mecanismo concreto se definirá en `07-ARQUITECTURA-TECNICA.md`.

---

# 60. Regla general de operaciones financieras

Las operaciones que afecten:

- inventario;
- caja;
- créditos;
- compras;
- ventas;

deberán diseñarse como **casos de uso de dominio**.

No deberán depender de que el frontend haga varias llamadas independientes.

Incorrecto:

```text
POST /sales
POST /inventory/movement
POST /cash/movement
```

desde el navegador para completar una venta.

Correcto conceptualmente:

```text
POST /sales/:id/complete
```

y el backend ejecuta todos los efectos necesarios dentro de una transacción.

---

# 61. Regla general de cancelaciones

Las cancelaciones no significan eliminar.

```text
Original
   │
   ▼
CANCELLED
   │
   ├── Movimiento inverso
   ├── Auditoría
   └── Historial conservado
```

Esto aplica a:

- ventas;
- compras;
- movimientos;
- operaciones financieras.

---

# 62. Regla general de referencias

Cuando un movimiento sea generado por otra operación deberá conservarse su referencia.

Ejemplo:

```text
InventoryMovement
referenceType = SALE
referenceId   = sale.id
```

Esto permite navegar:

```text
Kardex
   ↓
Movimiento
   ↓
Venta
```

o:

```text
Caja
   ↓
CashMovement
   ↓
Venta
```

---

# 63. Flujo completo de una venta

El flujo operativo más importante del sistema será:

```text
                    ┌───────────────┐
                    │ Crear venta   │
                    └───────┬───────┘
                            │
                            ▼
                       DRAFT
                            │
                            ▼
                    Agregar productos
                            │
                            ▼
                    Seleccionar cliente
                            │
                            ▼
                    Seleccionar pago
                            │
                            ▼
                    Validaciones
                            │
                    ┌───────┴────────┐
                    │                │
                  ERROR             OK
                    │                │
                    ▼                ▼
                 RECHAZAR       TRANSACTION
                                      │
                ┌─────────────────────┼─────────────────┐
                │                     │                 │
                ▼                     ▼                 ▼
             Sale               Inventory          Payment
                                  Movement
                                                        │
                                  ┌─────────────────────┼──────────────┐
                                  │                     │              │
                                CASH                  CREDIT       CARD/TRANSFER
                                  │                     │
                                  ▼                     ▼
                              CashMovement        CreditMovement
                                  │                     │
                                  └──────────┬──────────┘
                                             ▼
                                         AuditLog
                                             │
                                             ▼
                                           COMMIT
```

---

# 64. Flujo completo de una compra

```text
Crear compra
      │
      ▼
DRAFT
      │
      ▼
Agregar productos
      │
      ▼
Seleccionar proveedor
      │
      ▼
Validar
      │
      ▼
COMPLETED
      │
      ├── Purchase
      ├── PurchaseItems
      ├── InventoryMovement(IN)
      ├── InventoryBalance
      ├── AverageCost
      └── AuditLog
```

---

# 65. Flujo completo de crédito

```text
Venta a crédito
      │
      ▼
CreditMovement(SALE)
      │
      ▼
Saldo pendiente
      │
      ▼
Cliente realiza abono
      │
      ▼
CreditMovement(PAYMENT)
      │
      ├── CASH → CashMovement
      └── CARD/TRANSFER
      │
      ▼
Recalcular saldo
      │
      ▼
PENDING / PARTIAL / PAID
```

---

# 66. Flujo completo de caja

```text
Abrir caja
    │
    ▼
OPEN
    │
    ├── Venta CASH
    ├── Abono CASH
    ├── Otros ingresos
    ├── Gastos
    └── Retiros
    │
    ▼
Calcular esperado
    │
    ▼
Contar efectivo
    │
    ▼
Cerrar caja
    │
    ▼
CLOSED
```

---

# 67. Flujo completo del SaaS

```text
Crear Tenant
     │
     ▼
Asignar Plan
     │
     ▼
Crear Subscription
     │
     ▼
ACTIVE
     │
     │ vence período
     ▼
PAST_DUE
     │
     │ termina grace period
     ▼
SUSPENDED
     │
     │ pago
     ▼
ACTIVE
```

Los datos del tenant permanecen almacenados durante todo el ciclo.

---

# 68. Principio de integridad

El sistema deberá priorizar:

```text
Integridad > comodidad de implementación
```

No se deberán implementar atajos como:

```text
actualizar stock manualmente
actualizar saldo directamente
borrar venta
borrar compra
borrar movimiento de caja
```

cuando exista una alternativa basada en movimientos y operaciones de dominio.

---

# 69. Casos que deberán probarse obligatoriamente

Antes de considerar funcional un módulo se deberán probar al menos:

### Inventario

```text
Compra aumenta stock
Venta reduce stock
Venta sin stock falla
Ajuste aumenta stock
Ajuste reduce stock
Inventario nunca queda negativo
```

### Ventas

```text
Venta draft no modifica stock
Venta completada modifica stock
Venta CASH modifica caja
Venta CARD no modifica efectivo
Venta TRANSFER no modifica efectivo
Venta CREDIT aumenta deuda
Venta cancelada revierte efectos
```

### Compras

```text
Compra draft no modifica stock
Compra completada aumenta stock
Compra cancelada revierte inventario
Costo promedio se actualiza correctamente
```

### Créditos

```text
Venta crédito aumenta deuda
Abono reduce deuda
Abono CASH aumenta caja
Abono CARD no aumenta caja
Límite de crédito se respeta
Ajuste queda auditado
```

### Caja

```text
No se pueden abrir dos sesiones simultáneas
Venta CASH aumenta efectivo esperado
Abono CASH aumenta efectivo esperado
Gasto reduce efectivo esperado
Retiro reduce efectivo esperado
Cierre calcula diferencia correctamente
Caja cerrada no acepta movimientos
```

### SaaS

```text
Tenant aislado
Usuario sin membership no accede
Plan limita usuarios
Plan limita productos
Feature deshabilitada bloquea operación
Subscription vencida entra en PAST_DUE
Suspensión bloquea operaciones
Pago reactiva tenant
```

---

# 70. Principio final

El sistema deberá construirse alrededor de operaciones de negocio, no alrededor de simples CRUD.

No se debe pensar únicamente:

```text
crear venta
editar venta
eliminar venta
```

sino:

```text
crear venta
completar venta
cancelar venta
devolver venta
```

De igual manera:

```text
crear compra
completar compra
cancelar compra
```

y:

```text
abrir caja
registrar movimiento
cerrar caja
```

Este enfoque garantiza que los cambios sobre inventario, dinero y créditos ocurran de manera controlada y trazable.

---

# 71. Próximo documento

Con el modelo de dominio y los flujos operativos definidos, el siguiente documento será:

```text
06-REQUERIMIENTOS-FUNCIONALES.md
```

Este documento traducirá los flujos anteriores a requerimientos funcionales concretos, organizados por módulo.

Deberá definir:

```text
RF-001 ...
RF-002 ...
RF-003 ...
```

incluyendo:

- actores;
- precondiciones;
- comportamiento;
- validaciones;
- resultados esperados;
- permisos;
- restricciones;
- criterios de aceptación.

Posteriormente:

```text
07-ARQUITECTURA-TECNICA.md
```

convertirá todo lo anterior en decisiones concretas de:

- Next.js;
- NestJS;
- Prisma;
- PostgreSQL;
- autenticación;
- autorización;
- multi-tenancy;
- transacciones;
- concurrencia;
- estructura del monorepo;
- API REST;
- validación;
- testing;
- despliegue.