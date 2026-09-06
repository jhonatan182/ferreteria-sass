# 04 — MODELO DE DOMINIO

**Proyecto:** Sistema SaaS para Ferreterías  
**Versión:** 1.0  
**Estado:** Propuesto para aprobación

---

## 1. Objetivo

Este documento define el modelo conceptual de dominio del sistema.

Su propósito es establecer:

- Las entidades principales del sistema.
- La responsabilidad de cada entidad.
- Las relaciones entre entidades.
- La separación entre el dominio SaaS y el dominio operativo de cada ferretería.
- Las reglas de pertenencia a un tenant.
- Las entidades necesarias para soportar inventario, compras, ventas, créditos, caja y auditoría.
- Las decisiones estructurales que deberán respetarse posteriormente al implementar el modelo de datos con Prisma y PostgreSQL.

Este documento **no define todavía el esquema físico de PostgreSQL ni el `schema.prisma`**.

---

# 2. Principios del modelo

## MD-001 — Multi-tenancy desde el inicio

El sistema será multi-tenant desde su primera versión.

Una misma instancia de la aplicación podrá administrar múltiples ferreterías independientes.

Cada ferretería será representada por una entidad `Tenant`.

---

## MD-002 — Aislamiento obligatorio por tenant

Los datos operativos pertenecientes a una ferretería no podrán ser consultados ni modificados desde otra ferretería.

Cuando una entidad pertenezca directamente a un tenant, deberá almacenar `tenantId`.

Cuando una entidad pertenezca indirectamente a un tenant mediante otra entidad, el backend deberá validar la pertenencia antes de operar sobre ella.

---

## MD-003 — El tenant representa una empresa o negocio

`Tenant` representa la organización que utiliza el sistema.

No debe confundirse con:

- usuario;
- sucursal;
- plan;
- suscripción;
- cuenta bancaria;
- caja.

Un tenant puede tener múltiples usuarios.

La posibilidad de manejar múltiples sucursales podrá agregarse posteriormente sin modificar el concepto de tenant.

---

## MD-004 — Separación entre SaaS y negocio

El modelo tendrá dos grandes áreas:

```text
SaaS / Plataforma
        │
        ├── Tenants
        ├── Usuarios
        ├── Roles
        ├── Permisos
        ├── Planes
        ├── Features
        ├── Límites
        ├── Suscripciones
        ├── Pagos SaaS
        └── Auditoría de plataforma

Dominio de negocio
        │
        ├── Productos
        ├── Inventario
        ├── Compras
        ├── Ventas
        ├── Clientes
        ├── Proveedores
        ├── Créditos
        ├── Caja
        └── Auditoría operativa
```

El dominio SaaS pertenece al proveedor de la plataforma.

El dominio operativo pertenece a cada tenant.

---

# 3. Identidad y acceso

## 3.1 User

Representa una persona que puede autenticarse en la plataforma.

### Responsabilidades

- Identificación del usuario.
- Autenticación.
- Estado de acceso.
- Información básica de la cuenta.

### Atributos conceptuales

```text
User
├── id
├── name
├── email
├── passwordHash / mecanismo de autenticación
├── status
├── lastLoginAt
├── createdAt
└── updatedAt
```

El usuario no pertenece directamente a un único tenant.

La relación con los tenants se establece mediante `TenantMembership`.

---

# 4. Membresías

## 4.1 TenantMembership

Representa la relación entre un usuario y un tenant.

```text
User
   │
   └── TenantMembership
             │
             ├── Tenant
             └── Role
```

### Responsabilidades

- Determinar a qué tenant pertenece un usuario.
- Determinar qué rol tiene dentro del tenant.
- Permitir que un mismo usuario pueda pertenecer eventualmente a varios tenants.

### Atributos conceptuales

```text
TenantMembership
├── id
├── tenantId
├── userId
├── roleId
├── status
├── createdAt
└── updatedAt
```

Un usuario puede tener:

```text
User A
 ├── Tenant A → OWNER
 └── Tenant B → MANAGER
```

Esto permite que la arquitectura soporte crecimiento futuro sin rediseñar autenticación.

---

# 5. Tenant

## 5.1 Tenant

Representa una ferretería o empresa cliente.

### Atributos conceptuales

```text
Tenant
├── id
├── name
├── legalName
├── identificationNumber
├── phone
├── email
├── address
├── status
├── createdAt
└── updatedAt
```

Los campos fiscales exactos podrán ampliarse posteriormente.

No deben introducirse reglas fiscales específicas directamente en la entidad sin una decisión funcional previa.

---

# 6. Roles y permisos

## 6.1 Role

Representa un rol dentro de un tenant.

Ejemplos:

```text
OWNER
MANAGER
CASHIER
INVENTORY_MANAGER
PURCHASES_MANAGER
```

### Atributos

```text
Role
├── id
├── tenantId
├── name
├── description
├── isSystem
├── createdAt
└── updatedAt
```

Los roles pertenecen al tenant.

Los roles del sistema pueden utilizarse como roles iniciales protegidos.

---

## 6.2 Permission

Representa una acción autorizable.

Ejemplos:

```text
products.read
products.create
sales.create
sales.cancel
inventory.adjust
cash.close
credits.collect
users.create
roles.manage_permissions
```

Los permisos representan acciones y no planes comerciales.

---

## 6.3 RolePermission

Entidad intermedia entre roles y permisos.

```text
Role
  │
  └── RolePermission ── Permission
```

Permite asignar múltiples permisos a un rol.

No se utilizará herencia entre roles en la primera versión.

---

# 7. Planes y funcionalidades SaaS

## 7.1 Plan

Representa un plan comercial de la plataforma.

Ejemplos:

```text
BASIC
PROFESSIONAL
PREMIUM
```

### Atributos conceptuales

```text
Plan
├── id
├── name
├── description
├── price
├── billingInterval
├── isActive
├── createdAt
└── updatedAt
```

Los precios son información del SaaS y no pertenecen al tenant operativo.

---

## 7.2 Feature

Representa una funcionalidad que puede estar habilitada o deshabilitada según el plan.

Ejemplos:

```text
CREDITS
CASH
ADVANCED_REPORTS
PAYROLL
```

---

## 7.3 PlanFeature

Relaciona un plan con una funcionalidad.

```text
Plan
  │
  └── PlanFeature ── Feature
```

Permite que las funcionalidades sean configurables.

No se deberán implementar reglas como:

```text
if plan === "PREMIUM"
```

para determinar acceso funcional.

La aplicación deberá consultar las capacidades del plan.

---

## 7.4 PlanLimit

Representa límites comerciales asociados a un plan.

Ejemplos:

```text
MAX_USERS
MAX_PRODUCTS
```

### Concepto

```text
Plan
  │
  └── PlanLimit
       ├── key
       └── value
```

El valor podrá representar una cantidad máxima.

Un valor especial podrá representar ausencia de límite comercial.

---

# 8. Suscripciones

## 8.1 Subscription

Representa la suscripción de un tenant a un plan.

```text
Tenant
   │
   └── Subscription
           │
           └── Plan
```

### Atributos

```text
Subscription
├── id
├── tenantId
├── planId
├── status
├── startDate
├── currentPeriodStart
├── currentPeriodEnd
├── createdAt
└── updatedAt
```

Estados:

```text
ACTIVE
PAST_DUE
SUSPENDED
CANCELLED
```

No se utilizará un booleano como:

```text
paid = true
```

porque no representa correctamente el ciclo de vida de una suscripción.

---

## 8.2 SubscriptionPeriod

Representa períodos históricos de una suscripción.

Permite conservar información sobre:

- período;
- plan utilizado;
- fechas;
- estado;
- renovación.

Esto evita perder historial cuando el tenant cambia de plan.

---

## 8.3 SaaSPayment

Representa pagos realizados por el tenant al proveedor del SaaS.

Debe mantenerse separado de los pagos realizados por clientes de la ferretería.

```text
Tenant
   │
   └── Subscription
          │
          └── SaaSPayment
```

### Ejemplo

```text
Tenant → Ferretería El Centro
SaaSPayment → L. 1,500
Concepto → Suscripción septiembre
```

Esta entidad pertenece al dominio SaaS.

---

# 9. Productos

## 9.1 Product

Representa un artículo comercializado por la ferretería.

### Atributos conceptuales

```text
Product
├── id
├── tenantId
├── internalCode
├── barcode
├── name
├── description
├── categoryId
├── brandId
├── baseUnitId
├── status
├── createdAt
└── updatedAt
```

### Identificadores

`internalCode` y `barcode` son conceptos diferentes.

Ejemplo:

```text
internalCode = FER-000125
barcode      = 7501234567890
```

Un producto puede existir sin código de barras.

---

## 9.2 Category

Representa una categoría de productos.

Ejemplos:

```text
Herramientas
Plomería
Electricidad
Construcción
Pintura
Tornillería
```

Las categorías serán tenant-scoped para permitir que cada negocio organice sus productos según sus necesidades.

---

## 9.3 Brand

Representa una marca de producto.

Ejemplos:

```text
Truper
Stanley
Pretul
Makita
```

También será tenant-scoped inicialmente.

Esto permite que cada ferretería pueda utilizar su propio catálogo.

---

# 10. Unidades de medida

## 10.1 Unit

Representa una unidad de medida utilizada por el sistema.

Ejemplos:

```text
UNIDAD
LIBRA
KILOGRAMO
METRO
LITRO
GALON
CAJA
ROLLO
```

Las unidades comunes pueden formar parte de un catálogo global del sistema.

No significa que todas las unidades deban estar disponibles para todos los productos.

---

## 10.2 ProductPresentation

Representa una presentación o unidad comercial de un producto.

Ejemplo:

```text
Producto: Cemento

Base:
LIBRA

Presentaciones:

1 libra
50 libras → 50 unidades base
1 quintal → 100 unidades base
```

### Atributos conceptuales

```text
ProductPresentation
├── id
├── productId
├── unitId
├── name
├── conversionFactor
├── salePrice
├── isDefault
├── status
├── createdAt
└── updatedAt
```

El inventario siempre se almacenará en la unidad base.

La presentación solamente define cómo se comercializa el producto.

---

# 11. Inventario

## 11.1 InventoryBalance

Representa la existencia actual de un producto.

```text
Product
   │
   └── InventoryBalance
```

### Concepto

```text
InventoryBalance
├── id
├── tenantId
├── productId
├── quantity
├── averageCost
├── updatedAt
└── ...
```

La existencia representa la cantidad en unidad base.

---

## 11.2 InventoryMovement

Representa cualquier movimiento que modifique inventario.

Ejemplos:

```text
PURCHASE
SALE
SALE_RETURN
PURCHASE_RETURN
ADJUSTMENT_IN
ADJUSTMENT_OUT
```

### Concepto

```text
InventoryMovement
├── id
├── tenantId
├── productId
├── movementType
├── quantity
├── unitId
├── baseQuantity
├── unitCost
├── reason
├── referenceType
├── referenceId
├── createdBy
├── createdAt
└── ...
```

`baseQuantity` representa la cantidad real que afecta inventario.

Ejemplo:

```text
Compra:
20 bolsas × 50 lb

quantity      = 20
unit          = BOLSA
baseQuantity  = 1000 lb
```

---

# 12. Referencias de movimientos

Los movimientos de inventario deben poder relacionarse con el documento que los originó.

Ejemplo:

```text
InventoryMovement
       │
       └── reference
             ├── Purchase
             ├── Sale
             ├── Return
             └── Adjustment
```

Para evitar una gran cantidad de relaciones opcionales dentro de `InventoryMovement`, inicialmente se utilizará un concepto de referencia:

```text
referenceType
referenceId
```

La integridad de esta referencia será validada por la capa de dominio.

Ejemplo:

```text
referenceType = SALE
referenceId   = 8c4...
```

Esto permitirá mantener el modelo relativamente simple sin llenar la tabla con columnas como:

```text
saleId
purchaseId
adjustmentId
returnId
...
```

---

# 13. Costos

El sistema utilizará inicialmente **costo promedio ponderado**.

El costo promedio de un producto podrá actualizarse al completar una compra.

Ejemplo conceptual:

```text
Existencia:
100 unidades × L. 10 = L. 1,000

Compra:
50 unidades × L. 12 = L. 600

Total:
150 unidades
Costo total:
L. 1,600

Costo promedio:
L. 10.6667
```

El sistema deberá conservar suficiente información histórica para reconstruir los costos utilizados en las operaciones.

---

# 14. Proveedores

## 14.1 Supplier

Representa un proveedor de la ferretería.

```text
Supplier
├── id
├── tenantId
├── name
├── identificationNumber
├── phone
├── email
├── address
├── status
├── createdAt
└── updatedAt
```

---

# 15. Compras

## 15.1 Purchase

Representa una compra realizada a un proveedor.

```text
Purchase
├── id
├── tenantId
├── supplierId
├── documentNumber
├── date
├── status
├── subtotal
├── tax
├── total
├── notes
├── createdBy
├── completedBy
├── createdAt
└── updatedAt
```

Estados:

```text
DRAFT
COMPLETED
CANCELLED
```

---

## 15.2 PurchaseItem

Representa una línea de una compra.

```text
PurchaseItem
├── id
├── purchaseId
├── productId
├── presentationId
├── quantity
├── unitCost
├── baseQuantity
├── subtotal
├── tax
└── total
```

El `baseQuantity` permite conocer cuánto inventario debe aumentar independientemente de la presentación utilizada.

---

# 16. Proveedores y saldos

La primera versión no implementará un módulo contable completo de cuentas por pagar.

Sin embargo, el modelo deberá permitir distinguir:

```text
Compra pagada
Compra pendiente
Compra parcialmente pagada
```

Si posteriormente se requiere administrar cuentas por pagar completas, se podrá agregar un ledger de proveedores sin modificar el concepto fundamental de `Purchase`.

La implementación inicial deberá evitar crear contabilidad innecesaria si el negocio no la requiere.

---

# 17. Clientes

## 17.1 Customer

Representa un cliente de la ferretería.

```text
Customer
├── id
├── tenantId
├── name
├── identificationNumber
├── phone
├── email
├── address
├── creditLimit
├── status
├── createdAt
└── updatedAt
```

Un cliente puede realizar:

- compras normales;
- compras al contado;
- compras mediante tarjeta;
- compras mediante transferencia;
- compras al crédito.

---

# 18. Ventas

## 18.1 Sale

Representa una venta.

```text
Sale
├── id
├── tenantId
├── customerId
├── documentNumber
├── date
├── status
├── subtotal
├── tax
├── total
├── createdBy
├── completedBy
├── createdAt
└── updatedAt
```

Estados:

```text
DRAFT
COMPLETED
CANCELLED
```

El cliente puede ser `null` para ventas normales sin cliente identificado.

Una venta a crédito siempre deberá tener cliente.

---

## 18.2 SaleItem

Representa una línea de venta.

```text
SaleItem
├── id
├── saleId
├── productId
├── presentationId
├── quantity
├── unitPrice
├── unitCost
├── baseQuantity
├── subtotal
├── tax
└── total
```

El `unitCost` utilizado durante la venta deberá conservarse para permitir posteriormente calcular rentabilidad histórica.

No se deberá depender exclusivamente del costo actual del producto.

---

# 19. Pagos de ventas

## 19.1 SalePayment

Representa un pago asociado a una venta.

Métodos iniciales:

```text
CASH
CARD
TRANSFER
CREDIT
```

Aunque inicialmente una venta pueda utilizar un único método de pago, se recomienda modelar el pago como una entidad separada.

Esto permite soportar posteriormente:

```text
Total venta: L. 1,000

Efectivo:     L. 600
Tarjeta:      L. 400
```

sin rediseñar las ventas.

### Concepto

```text
Sale
 │
 └── SalePayment
       ├── paymentMethod
       ├── amount
       ├── reference
       └── createdAt
```

Una venta a crédito genera el saldo correspondiente en el módulo de créditos.

---

# 20. Créditos

## 20.1 CreditAccount

Representa la cuenta de crédito de un cliente.

```text
Customer
   │
   └── CreditAccount
```

No se recomienda guardar únicamente:

```text
balance = 2700
```

como fuente de verdad.

El saldo debe poder reconstruirse a partir de movimientos.

---

## 20.2 CreditMovement

Representa cualquier movimiento sobre la cuenta de crédito.

Tipos:

```text
SALE
PAYMENT
ADJUSTMENT
```

### Concepto

```text
CreditMovement
├── id
├── tenantId
├── creditAccountId
├── type
├── amount
├── referenceType
├── referenceId
├── reason
├── createdBy
└── createdAt
```

Ejemplo:

```text
Venta       + L. 2,500
Venta       + L. 1,200
Abono       - L. 1,000
-----------------------
Saldo       = L. 2,700
```

---

## 20.3 CreditPayment

Un abono representa un movimiento de crédito de tipo `PAYMENT`.

Debe registrar:

- cliente;
- cuenta de crédito;
- monto;
- fecha;
- usuario;
- método de pago;
- referencia;
- observación.

Si el abono es en efectivo, genera un ingreso en caja.

Si es mediante tarjeta o transferencia, no aumenta el efectivo físico.

---

# 21. Caja

## 21.1 CashRegister

Representa una caja física u operacional.

```text
CashRegister
├── id
├── tenantId
├── name
├── status
├── createdAt
└── updatedAt
```

Inicialmente puede existir una sola caja por tenant.

El modelo debe permitir varias cajas posteriormente.

---

## 21.2 CashSession

Representa una apertura y cierre de caja.

```text
CashRegister
      │
      └── CashSession
             ├── openedBy
             ├── openingAmount
             ├── openedAt
             ├── closedBy
             ├── closingAmount
             ├── expectedAmount
             ├── difference
             ├── status
             └── closedAt
```

Estados:

```text
OPEN
CLOSED
```

Una caja no puede tener más de una sesión abierta simultáneamente en el mismo contexto operativo.

---

## 21.3 CashMovement

Representa movimientos físicos de efectivo.

Tipos conceptuales:

```text
SALE
CREDIT_PAYMENT
OTHER_INCOME
EXPENSE
WITHDRAWAL
REFUND
ADJUSTMENT
```

### Concepto

```text
CashMovement
├── id
├── tenantId
├── cashSessionId
├── type
├── amount
├── referenceType
├── referenceId
├── reason
├── createdBy
└── createdAt
```

---

# 22. Relación entre ventas, créditos y caja

Una venta completada puede producir efectos en diferentes dominios.

### Venta en efectivo

```text
Sale
 ├── SaleItem
 ├── InventoryMovement
 └── SalePayment(CASH)
          │
          └── CashMovement(INCOME)
```

### Venta con tarjeta

```text
Sale
 ├── SaleItem
 ├── InventoryMovement
 └── SalePayment(CARD)
```

No genera ingreso físico en caja.

### Venta por transferencia

```text
Sale
 ├── SaleItem
 ├── InventoryMovement
 └── SalePayment(TRANSFER)
```

No genera ingreso físico en caja.

### Venta al crédito

```text
Sale
 ├── SaleItem
 ├── InventoryMovement
 └── SalePayment(CREDIT)
          │
          └── CreditMovement(SALE)
```

---

# 23. Devoluciones

Las devoluciones no deberán implementarse modificando la venta original.

Una devolución será una operación independiente relacionada con la operación original.

Conceptualmente:

```text
Sale
  │
  └── SaleReturn
        └── SaleReturnItem
```

Una devolución podrá producir:

```text
InventoryMovement(IN)
```

y, dependiendo de la situación:

```text
CashMovement(OUT)
CreditMovement(ADJUSTMENT/PAYMENT)
```

Las reglas exactas de devolución y reembolso deberán detallarse en el documento de flujos operativos.

---

# 24. Ajustes de inventario

Los ajustes representan correcciones manuales de inventario.

Conceptualmente:

```text
InventoryAdjustment
├── id
├── tenantId
├── productId
├── quantity
├── direction
├── reason
├── createdBy
├── approvedBy
└── createdAt
```

Los ajustes importantes deberán quedar auditados.

No se deberá permitir modificar directamente el saldo de inventario desde la interfaz.

---

# 25. Auditoría

## 25.1 AuditLog

Representa acciones relevantes realizadas dentro del sistema.

### Atributos conceptuales

```text
AuditLog
├── id
├── tenantId
├── userId
├── action
├── entityType
├── entityId
├── metadata
├── createdAt
└── ...
```

Ejemplos:

```text
SALE_CANCELLED
SALE_REFUNDED
INVENTORY_ADJUSTED
PRODUCT_COST_CHANGED
PRODUCT_PRICE_CHANGED
CASH_CLOSED
CREDIT_ADJUSTED
USER_CREATED
ROLE_UPDATED
```

La auditoría deberá ser append-only.

No se deberá editar ni eliminar históricamente un registro de auditoría desde la aplicación.

---

# 26. Auditoría de plataforma

Las operaciones administrativas del SaaS deberán poder distinguirse de las operaciones de una ferretería.

Ejemplos:

```text
TENANT_CREATED
PLAN_CHANGED
SUBSCRIPTION_CREATED
SUBSCRIPTION_SUSPENDED
PAYMENT_REGISTERED
TENANT_REACTIVATED
```

Se recomienda utilizar una entidad de auditoría de plataforma separada:

```text
PlatformAuditLog
```

Esto evita mezclar:

```text
"El cajero canceló una venta"

con

"El administrador de la plataforma suspendió el tenant"
```

---

# 27. Numeración de documentos

Los documentos operativos deberán utilizar numeración controlada por tenant.

Ejemplos:

```text
FAC-000001
FAC-000002

COMP-000001
COMP-000002
```

El número debe ser único dentro del tenant y del tipo de documento correspondiente.

Se deberá evitar depender únicamente de UUID como número visible para el usuario.

Los UUID pueden utilizarse como identificadores internos.

---

# 28. Dinero y precisión

Los valores monetarios deberán almacenarse utilizando tipos numéricos adecuados para dinero.

No se utilizará `float` para:

- precios;
- costos;
- impuestos;
- totales;
- pagos;
- saldos.

PostgreSQL deberá utilizar `numeric/decimal` con una precisión definida.

La política exacta de escala y redondeo deberá establecerse antes de implementar el esquema físico.

---

# 29. Impuestos

El modelo no deberá asumir inicialmente una tasa fija.

No se deberá codificar directamente algo como:

```text
tax = subtotal * 0.15
```

como regla universal.

La arquitectura deberá permitir posteriormente:

- diferentes tasas;
- productos exentos;
- impuestos configurables;
- cambios regulatorios.

La definición fiscal específica se documentará cuando el alcance de facturación fiscal sea aprobado.

---

# 30. Estados frente a eliminación física

Las entidades que tengan impacto histórico en:

- inventario;
- dinero;
- ventas;
- compras;
- créditos;
- caja;

no deberán eliminarse físicamente cuando ya hayan participado en operaciones.

Se utilizarán estados y operaciones compensatorias.

Ejemplos:

```text
Producto → INACTIVE

Venta → CANCELLED

Compra → CANCELLED

Caja → CLOSED

Usuario → INACTIVE
```

La eliminación física deberá reservarse para entidades donde no destruya información histórica relevante.

---

# 31. Relaciones principales

La estructura conceptual general será:

```text
                         ┌──────────────┐
                         │    Tenant    │
                         └──────┬───────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
           ▼                    ▼                    ▼
   Subscriptions          Memberships          Business Data
           │                    │                    │
           ▼                    ▼                    ▼
         Plan                  User             Products
                                  │                  │
                                  ▼                  ▼
                                Role          Presentations
                                  │
                                  ▼
                             Permission
```

Dominio operativo:

```text
Tenant
 │
 ├── Products
 │     ├── Category
 │     ├── Brand
 │     └── ProductPresentation
 │
 ├── Inventory
 │     ├── InventoryBalance
 │     └── InventoryMovement
 │
 ├── Suppliers
 │     └── Purchases
 │            └── PurchaseItems
 │
 ├── Customers
 │     ├── Sales
 │     │    └── SaleItems
 │     │
 │     └── CreditAccount
 │            └── CreditMovements
 │
 └── Cash
       ├── CashRegister
       ├── CashSession
       └── CashMovement
```

---

# 32. Relación completa de operaciones

Una operación de compra:

```text
Supplier
   │
   ▼
Purchase
   │
   └── PurchaseItem
          │
          ▼
   InventoryMovement
          │
          ▼
   InventoryBalance
```

Una operación de venta:

```text
Customer (optional)
       │
       ▼
     Sale
       │
       ├── SaleItem
       │      │
       │      ▼
       │ InventoryMovement
       │
       └── SalePayment
               │
               ├── CASH ──────► CashMovement
               │
               ├── CARD
               │
               ├── TRANSFER
               │
               └── CREDIT ────► CreditMovement
```

Un abono de crédito:

```text
Customer
   │
   ▼
CreditAccount
   │
   ▼
CreditMovement(PAYMENT)
   │
   └── CASH ──► CashMovement
```

---

# 33. Regla de transacciones

Las operaciones que produzcan múltiples efectos deberán ejecutarse dentro de una única transacción de base de datos.

### Ejemplo: completar venta

```text
BEGIN

Validar venta
Validar permisos
Validar tenant
Validar stock
Calcular totales

Crear Sale
Crear SaleItems

Crear InventoryMovements
Actualizar InventoryBalance

Crear SalePayment

Si es CREDIT:
    Crear CreditMovement

Si es CASH:
    Crear CashMovement

Crear AuditLog

COMMIT
```

Si cualquiera de los pasos falla:

```text
ROLLBACK
```

No deberá quedar una venta registrada con inventario actualizado parcialmente.

---

# 34. Fuente de verdad

El sistema deberá distinguir entre datos derivados y datos históricos.

### Inventario

Los movimientos representan el historial.

El balance representa el estado actual optimizado para consulta.

```text
InventoryMovement → historial
InventoryBalance  → estado actual
```

### Créditos

Los movimientos representan el historial.

El saldo puede calcularse a partir de movimientos o mantenerse como valor derivado cuidadosamente sincronizado.

```text
CreditMovement → historial
CreditAccount  → cuenta/estado actual
```

### Caja

Los movimientos representan los movimientos de efectivo.

La sesión representa el período de apertura/cierre.

```text
CashMovement → movimientos
CashSession  → período operativo
```

---

# 35. Consistencia de tenant

Toda operación de dominio deberá seguir conceptualmente:

```text
Authenticated User
        │
        ▼
Tenant Membership
        │
        ▼
Tenant Context
        │
        ▼
Authorization
        │
        ▼
Resource Ownership
        │
        ▼
Business Operation
```

Nunca deberá aceptarse un `tenantId` arbitrario enviado por el frontend como mecanismo suficiente para determinar el contexto.

El backend deberá establecer y validar el tenant a partir de la membresía/autorización del usuario.

---

# 36. Identificadores

Las entidades utilizarán identificadores internos estables.

Se recomienda utilizar UUID para identificadores internos.

Los identificadores visibles al usuario serán independientes cuando sea necesario.

Ejemplo:

```text
id interno:
550e8400-e29b-41d4-a716-446655440000

documentNumber:
VENT-000125
```

Esto evita exponer secuencias internas como identificadores técnicos.

---

# 37. Timestamps y actores

Las entidades operativas relevantes deberán conservar:

```text
createdAt
updatedAt
```

Las operaciones críticas deberán conservar también el usuario responsable.

Ejemplo:

```text
createdBy
completedBy
cancelledBy
approvedBy
closedBy
```

No todas las entidades necesitan todos estos campos.

Se agregarán únicamente cuando tengan valor histórico o de auditoría.

---

# 38. Convenciones de modelado

## 38.1 Nombres

Las entidades utilizarán nombres conceptuales en inglés en el código.

Ejemplo:

```text
Product
Purchase
Sale
Customer
Supplier
InventoryMovement
CashSession
CreditMovement
```

La interfaz de usuario estará en español.

---

## 38.2 Enum

Los estados y tipos de operación controlados deberán representarse mediante enums o catálogos apropiados.

Ejemplo:

```text
SaleStatus
PurchaseStatus
SubscriptionStatus
PaymentMethod
InventoryMovementType
CashMovementType
CreditMovementType
```

---

# 39. Entidades principales definitivas de V1

El modelo conceptual de V1 queda compuesto por:

### SaaS

```text
Tenant
User
TenantMembership
Role
Permission
RolePermission

Plan
Feature
PlanFeature
PlanLimit

Subscription
SubscriptionPeriod
SaaSPayment

PlatformAuditLog
```

### Catálogos y productos

```text
Product
Category
Brand
Unit
ProductPresentation
```

### Inventario

```text
InventoryBalance
InventoryMovement
InventoryAdjustment
```

### Compras

```text
Supplier
Purchase
PurchaseItem
```

### Ventas

```text
Customer
Sale
SaleItem
SalePayment
```

### Créditos

```text
CreditAccount
CreditMovement
```

### Caja

```text
CashRegister
CashSession
CashMovement
```

### Auditoría

```text
AuditLog
```

---

# 40. Entidades deliberadamente fuera de V1

No se implementarán inicialmente como parte del núcleo:

```text
Employee
Payroll
AccountingAccount
AccountsReceivable
AccountsPayable
BankAccount
FiscalInvoice
TaxAuthorityIntegration
PaymentProvider
Warehouse
Branch
LoyaltyProgram
PurchaseOrder
SalesQuotation
```

Estas entidades podrán incorporarse posteriormente si el producto lo requiere.

Esto evita construir módulos que todavía no tienen reglas de negocio suficientemente definidas.

---

# 41. Decisiones importantes

## MD-005 — No microservicios

El dominio se implementará inicialmente como un **monolito modular**.

```text
NestJS
   │
   ├── Auth
   ├── Tenants
   ├── Products
   ├── Inventory
   ├── Purchases
   ├── Sales
   ├── Credits
   ├── Cash
   └── Reports
```

No se crearán servicios independientes para cada módulo.

---

## MD-006 — No modificar saldos directamente

Los saldos importantes deberán provenir de operaciones de dominio.

No se permitirá una operación genérica como:

```text
UPDATE inventory SET quantity = ...
```

desde la lógica de presentación.

---

## MD-007 — No borrar historial financiero

Las operaciones históricas se corrigen mediante:

```text
Cancelación
Devolución
Ajuste
Movimiento compensatorio
```

y no mediante eliminación física.

---

## MD-008 — Pagos SaaS separados de pagos operativos

Debe mantenerse una separación clara:

```text
SaaSPayment
```

representa el pago de la ferretería al proveedor del SaaS.

```text
SalePayment
```

representa el pago del cliente a la ferretería.

```text
CreditMovement(PAYMENT)
```

representa un abono a una deuda del cliente.

```text
CashMovement
```

representa movimiento físico de efectivo.

No deberán mezclarse estos conceptos.

---

# 42. Resumen del dominio

El sistema puede entenderse como cinco grandes áreas:

```text
┌───────────────────────────────────────────┐
│                 PLATAFORMA                │
│ Tenant • Plans • Subscriptions • Billing  │
└───────────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────┐
│                IDENTIDAD                  │
│ Users • Memberships • Roles • Permissions │
└───────────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────┐
│               OPERACIÓN                   │
│ Products • Purchases • Sales • Inventory  │
└───────────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────┐
│                FINANZAS                   │
│ Cash • Credits • Payments                 │
└───────────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────┐
│              TRAZABILIDAD                 │
│ Audit Logs • Movements • History          │
└───────────────────────────────────────────┘
```

La prioridad del modelo es mantener:

1. aislamiento entre tenants;
2. consistencia transaccional;
3. trazabilidad;
4. historial inmutable;
5. separación clara entre conceptos;
6. posibilidad de crecimiento sin sobrearquitectura.

---

# 43. Próximo paso

Una vez aprobado este modelo conceptual, el siguiente documento será:

```text
05-FLUJOS-OPERATIVOS.md
```

En ese documento se definirán paso a paso las operaciones críticas:

```text
Crear producto
Comprar mercancía
Completar compra
Ajustar inventario
Crear venta
Completar venta
Vender al crédito
Registrar abono
Abrir caja
Registrar movimiento de caja
Cerrar caja
Cancelar venta
Procesar devolución
Cancelar compra
Suspender tenant
Reactivar suscripción
```

Después de validar los flujos podremos elaborar:

```text
06-REQUERIMIENTOS-FUNCIONALES.md
07-ARQUITECTURA-TECNICA.md
```

y finalmente pasar al diseño físico de PostgreSQL/Prisma.