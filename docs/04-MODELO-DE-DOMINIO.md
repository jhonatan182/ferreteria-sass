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

**Corrección (Fase 7, docs/04 §48 D1):** esta sección y RF-091/RF-092 entraban en
conflicto (`customerId` nulo vs. "cliente genérico"). Se implementó el cliente
general como una fila real de `Customer` (`isGeneralCustomer = true`, una por
tenant), de forma que `Sale.customerId` es **NOT NULL** siempre y RF-092
("una venta a crédito no puede asociarse al cliente general") es una regla
comprobable en el backend. Ver §48.1 D1.

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

---

# 44. Apéndice — Decisiones de implementación (Fase 2: fundación SaaS e identidad)

Esta fase materializó en `prisma/schema.prisma` las 14 entidades del bloque
SaaS de la sección 39 (`User`, `Tenant`, `TenantMembership`, `Role`,
`Permission`, `RolePermission`, `Plan`, `Feature`, `PlanFeature`, `PlanLimit`,
`Subscription`, `SubscriptionPeriod`, `SaaSPayment`, `PlatformAuditLog`) más el
seed inicial. Se registran aquí las decisiones que la documentación no cerraba,
para que código y documentación no diverjan (AGENTS.md 28, RN-101).

## 44.1 Decisiones sobre puntos abiertos

1. **Platform Admin** — se modela como `User.isPlatformAdmin: boolean`
   (`@default(false)`). No es un rol de tenant. Un Platform Admin no tiene
   `TenantMembership`, por lo que RP-008 (sin acceso automático a datos de
   tenant) se cumple estructuralmente. Si en el futuro se requiere soporte
   temporal a un tenant, será un mecanismo explícito y auditable aparte, nunca
   una puerta trasera.

2. **`Role` en el seed** — `Role.tenantId` es `NOT NULL` (fiel a la sección
   6.1). El mapeo rol → permisos vive en código
   (`apps/api/src/authz/role-templates.ts`) como fuente única para el seed y el
   futuro provisioning de tenants. El seed crea un tenant de desarrollo con sus
   5 roles `isSystem = true`.

3. **Contraseña del Platform Admin** — `User.passwordHash` es opcional
   (`String?`). El seed crea usuarios sin credencial. El algoritmo de hash y el
   establecimiento de la credencial son responsabilidad de la fase de
   autenticación.

4. **Grace period y moneda del plan** — `Plan.gracePeriodDays: Int @default(7)`
   y `Plan.currency: Char(3) @default("HNL")`. Configurable por plan es un
   superset de "configurable a nivel de plataforma" (docs/00 286-288) sin
   introducir una entidad de configuración global.

5. **Moneda y zona horaria del tenant** — `Tenant.baseCurrency: Char(3)
   @default("HNL")` y `Tenant.timezone: String @default("America/Tegucigalpa")`,
   exigidos por docs/07 756-772 aunque no aparezcan en la lista de atributos de
   la sección 5.1. `Tenant.baseCurrency` (moneda del negocio) es distinta de
   `Plan.currency` (moneda con que la plataforma cobra la suscripción).

6. **Estado de `SubscriptionPeriod`** — enum `PENDING | PAID | CANCELLED`
   (RN-090 exige un estado pero no enumera valores). Es el mínimo que soporta el
   ciclo RF-155/156/157.

7. **Nombres físicos** — tablas y columnas en `snake_case` vía `@@map`/`@map`
   (la documentación no fijaba convención). Los modelos y campos Prisma siguen
   en inglés PascalCase/camelCase según la sección 38.

8. **Suscripción vigente única por tenant** — índice único parcial en Postgres
   `subscription_one_active_per_tenant ON subscriptions (tenant_id) WHERE status
   IN ('ACTIVE','PAST_DUE')` (añadido a mano en la migración; no expresable en
   Prisma). Permite crear una suscripción nueva tras `CANCELLED`/`SUSPENDED`.

9. **`Plan.code`** — existe para identidad estable en seeds y migraciones.
   Queda **prohibido** ramificar lógica por `code` o `name` (AGENTS.md 19); el
   acceso funcional se resuelve por `Feature` y `PlanLimit`.

## 44.2 Inconsistencias detectadas en la documentación

Se señalan sin perpetuarlas (RN-101). El catálogo sembrado son exactamente los
70 permisos de docs/03 secciones 13-25.

- **`roles.manage`** aparece en docs/03 352 y 395 como permiso negado a CASHIER
  e INVENTORY_MANAGER, pero no existe en el catálogo formal de docs/03 611-618
  (que define `roles.manage_permissions`). Se interpreta como abreviatura
  informal; **no se siembra**.
- **`products.delete`** aparece en docs/03 337 como negado a CASHIER, pero no
  existe en docs/03 477-487 — coherente con la política de no borrado físico.
  **No se siembra**.
- **RF-113** (docs/06 498-500) exige un permiso para exceder el límite de
  crédito pero no da su código. Créditos está fuera de esta fase; queda
  pendiente, no se inventa el código.

## 44.3 Pendientes soportados por el modelo, no implementados en esta fase

- Job programado `ACTIVE → PAST_DUE → SUSPENDED` (docs/07 735-751, idempotente).
  El índice `subscriptions(status, current_period_end)` y
  `Subscription.gracePeriodEndsAt` existen para él.
- Entidad de configuración/numeración del tenant (docs/05 220-230). Los permisos
  `tenant.settings.*` ya se siembran; la entidad no está en la lista V1 de la
  sección 39.
- Política de escala y redondeo decimal (sección 28). El dinero SaaS usa
  `Decimal(12,2)`, suficiente y sin prejuzgar la escala del dominio operativo.
- Autenticación: no se implementa nada en esta fase.

---

# 45. Apéndice — Decisiones de implementación (Fase 4: catálogo de productos)

Esta fase materializó en `prisma/schema.prisma` las entidades de catálogo de la sección 39
(`Unit`, `Category`, `Brand`, `Product`, `ProductPresentation`) más `AuditLog` (auditoría
operativa, append-only) y una entidad auxiliar `TenantProductSequence`. Backend en
`apps/api/src/products/` y `apps/api/src/audit/`; frontend funcional en `apps/web/src/app/app/`.
**No** se implementaron existencias, `InventoryBalance`, `InventoryMovement`, compras, ventas,
caja, créditos ni reportes.

## 45.1 Decisiones sobre puntos abiertos (RN-101)

1. **`Unit` es tenant-owned** (D1). La sección 10.1 permitía un "catálogo global del sistema",
   pero docs/03 define el permiso **tenant-scoped** `products.manage_units` y docs/05 §8 pide
   configurar "unidades" al provisionar cada tenant. Se modela `Unit` con `tenantId` y
   `@@unique([tenantId, code])`. Cada tenant recibe una copia de `DEFAULT_TENANT_UNITS`
   (`apps/api/src/catalog/unit-catalog.ts`: UNIDAD, LIBRA, KILOGRAMO, QUINTAL, METRO, PIE, LITRO,
   GALON, CAJA, ROLLO), fuente única para el seed y el futuro provisioning.

2. **Generación de `internalCode`** (D2). docs/05 §10 pide "obtener siguiente secuencia
   independiente por tenant" sin definir la entidad. Se usa una tabla contador
   `TenantProductSequence { tenantId @id, prefix @default("FER"), padding @default(6), nextValue }`
   y, **dentro de la transacción de creación**, `UPDATE … SET next_value = next_value + 1
   RETURNING`. El row lock de Postgres serializa a los concurrentes (AGENTS.md 21); nunca
   `SELECT MAX(internal_code) + 1`. El prefijo es configurable por tenant (RN-006). Solo se
   autogenera si el usuario no envía `internalCode` (docs/05 §10); ante colisión con un código
   escrito a mano se reintenta hasta 5 veces.

3. **Autorización de categorías y marcas** (D3). El catálogo formal de docs/03 (477-487) no
   define `categories.*` ni `brands.*`, y los tests fijan 70 permisos exactos. Se **reusan**
   `products.read` / `products.create` / `products.update`. No se inventan códigos (RN-101,
   §44.2). Las unidades usan `products.manage_units` para escritura.

4. **Sin costo en esta fase** (D4). `averageCost` es atributo de `InventoryBalance` (sección
   11.1) y RN-102 prohíbe mutar saldos sin movimiento. `Product` **no** tiene ningún campo de
   costo; el permiso `products.change_cost` queda sin endpoint hasta el módulo de inventario /
   compras, donde el costo promedio ponderado nace de las compras (sección 13, docs/07 §19).
   El flujo docs/05 §13 ("modificar costo") queda pendiente para esa fase.

5. **Escala decimal** (D5). La sección 28 dejó la política "para antes del esquema físico" y
   nunca se cerró. Para el catálogo: `ProductPresentation.salePrice` = `Decimal(14,4)`;
   `ProductPresentation.conversionFactor` = `Decimal(18,6)`. Cantidades e importes viajan como
   **cadena** en la API, nunca `number` (AGENTS.md 11-12). El dinero de inventario/ventas
   (`unitCost`, `averageCost`, totales) fijará su escala en su fase; 4 decimales para precio
   son coherentes con el ejemplo de costo promedio "L. 10.6667" de la sección 13.

6. **Presentación principal única** (D6). `ProductPresentation.isDefault` con índice único
   **parcial** en Postgres `product_one_default_presentation ON product_presentations
   (product_id) WHERE is_default = true` (añadido a mano en la migración, no expresable en
   Prisma — mismo procedimiento que `subscription_one_active_per_tenant`). El servicio además
   valida a nivel de aplicación: la primera presentación de un producto nace principal;
   `set-default` mueve la marca dentro de una transacción; no se puede desactivar la principal
   sin designar otra antes.

7. **`AuditLog` operativo**. No existía (solo `PlatformAuditLog`). Es entidad V1 (sección 39) y
   requisito de RF-140 / docs/05 §57. Append-only (sin `updatedAt`, sin update/delete desde la
   aplicación). `AuditService.record(tx, ctx, entry)` escribe **dentro de la misma transacción**
   que la operación auditada (docs/05 §56). Acciones registradas en esta fase: `PRODUCT_CREATED`,
   `PRODUCT_UPDATED`, `PRODUCT_ACTIVATED`, `PRODUCT_DEACTIVATED`, `PRODUCT_PRICE_CHANGED`
   (metadata: `previousPrice`, `newPrice`, `reason`), `PRESENTATION_CREATED`,
   `PRESENTATION_UPDATED`, `PRESENTATION_DEFAULT_CHANGED`, `PRESENTATION_ACTIVATED`,
   `PRESENTATION_DEACTIVATED`, `CATALOG_ITEM_*`.

8. **`MAX_PRODUCTS` cuenta productos activos** — ver docs/05 §53 (actualizado en el mismo
   cambio). El chequeo (`LimitService.assertWithinLimit`) corre dentro de la transacción de
   `POST /products` y de `POST /products/:id/activate`. Productos es núcleo: no hay código de
   `Feature` para él, así que RF-013 (feature) no aplica, solo RF-014 (límite).

9. **`ProductPresentation.tenantId` desnormalizado** desde el producto, para poder ejecutar
   consultas tenant-aware directas sobre la presentación (AGENTS.md 5) sin un join a `products`.

10. **`onDelete`**: `Restrict` hacia `Tenant`, `Category`, `Brand`, `Unit` y `Product` (nada de
    catálogo se borra físicamente — RN-010). `TenantProductSequence` usa `Cascade` (es
    configuración, no historial). `AuditLog.user` usa `SetNull`.

## 45.2 Inconsistencias detectadas en la documentación (RN-101, no se perpetúan)

- **`INVENTORY_MANAGER` no puede activar/desactivar productos.** RP-015 lo define como
  "responsable de inventario y productos", pero RP-016 solo le da `products.read/create/update`.
  El módulo respeta la lista literal de docs/03; `products.activate` / `products.deactivate` /
  `manage_units` / `manage_presentations` / `change_price` quedan solo para OWNER y MANAGER.
- **`products.activate` no tiene flujo ni RF documentado.** docs/05 solo describe §14
  "desactivar producto"; docs/06 solo RF-056. Aquí `POST /products/:id/activate` re-aplica el
  chequeo de `MAX_PRODUCTS` (la reactivación consume plaza), regla que ningún documento
  explicita pero que se deduce de §53.
- **Un producto puede crearse sin presentaciones** (RF-050 no exige ninguna). Se permite; el
  producto no tiene precio vendible hasta que se le añade al menos una presentación. La primera
  que se añada nace principal.
- **`barcode` único con múltiples NULL**: `@@unique([tenantId, barcode])` — Postgres trata los
  NULL como distintos, así que varios productos sin código de barras no colisionan (mismo
  patrón que `SaaSPayment.reference`, verificado por los tests e2e).

## 45.3 Endpoints y permisos

```text
GET    /products                                     products.read
POST   /products                                     products.create
GET    /products/:id                                 products.read
PATCH  /products/:id                                  products.update
POST   /products/:id/activate                        products.activate
POST   /products/:id/deactivate                      products.deactivate
GET    /products/:id/presentations                   products.read
POST   /products/:id/presentations                   products.manage_presentations
PATCH  /products/:id/presentations/:pid              products.manage_presentations
POST   /products/:id/presentations/:pid/price        products.change_price
POST   /products/:id/presentations/:pid/set-default  products.manage_presentations
POST   /products/:id/presentations/:pid/activate     products.manage_presentations
POST   /products/:id/presentations/:pid/deactivate   products.manage_presentations
GET    /categories | /brands                         products.read
POST   /categories | /brands                         products.create
PATCH  /categories/:id | /brands/:id (+ activate/deactivate)   products.update
GET    /units                                        products.read
POST   /units  (+ PATCH, activate, deactivate)       products.manage_units
```

No hay `DELETE` en ninguna ruta (RN-010; `products.delete` no existe — §44.2).
`PATCH /presentations/:pid` **no** cambia el precio: para eso está el endpoint dedicado
`/price`, que es lo que hace efectivo `products.change_price` (docs/05 §12, RP-026).

## 45.4 Códigos de error nuevos

`apps/api/src/common/errors.ts`: `PRODUCT_CODE_TAKEN`, `PRODUCT_BARCODE_TAKEN` (409),
`CATALOG_NAME_TAKEN` (409), `CATALOG_IN_USE` (409, no se desactiva un catálogo referenciado por
productos activos), `INVALID_PRESENTATION` (422), `BUSINESS_RULE_VIOLATION` (422). Nuevas clases
atajo `NotFoundException` (404) y `BusinessRuleException` (422). Un recurso de otro tenant
devuelve **404**, no 403 — no filtra su existencia.

---

# 46. Apéndice — Decisiones de implementación (Fase 5: inventario)

Esta fase materializó `InventoryBalance`, `InventoryMovement` e `InventoryAdjustment`
(sección 39, bloque *Inventario*) más los enums `InventoryMovementType` e
`InventoryAdjustmentDirection`. Backend en `apps/api/src/inventory/`; frontend en
`apps/web/src/app/app/inventario/`. **No** se implementaron compras, ventas, clientes,
proveedores, caja, créditos ni reportes completos. `Purchase` / `Sale` no existen todavía.

## 46.1 Fuente de verdad y materialización

- `InventoryMovement` = historial **append-only** (sin `updatedAt`, sin update ni delete
  desde la aplicación; las correcciones son movimientos compensatorios — AGENTS.md §15-16).
- `InventoryBalance` = estado actual materializado. `quantity` **nunca** se fija desde un
  CRUD ni desde el frontend (RN-024, MD-006): solo cambia a través de una operación de
  dominio que genera un `InventoryMovement`. No hay ninguna ruta `PATCH`/`PUT` de inventario.
- El inventario se almacena **exclusivamente en la unidad base** del producto (RN-014). Las
  operaciones futuras con presentaciones convertirán antes con `toBaseQuantity(quantity,
  conversionFactor)` (`apps/api/src/inventory/inventory.core.ts`).

## 46.2 Decisiones sobre puntos abiertos (RN-101)

1. **Tipos de movimiento** (D1). Los ejemplos de la sección 11.2 no eran un catálogo
   cerrado. `InventoryMovementType` fija: `PURCHASE`, `SALE`, `RETURN_IN`, `RETURN_OUT`,
   `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `REVERSAL`. `RETURN_IN` = devolución de venta que
   entra a inventario (el ejemplo `SALE_RETURN`); `RETURN_OUT` = devolución a proveedor que
   sale (`PURCHASE_RETURN`); `REVERSAL` = reverso de una operación completada (cancelación
   de venta/compra). En esta fase solo se producen `ADJUSTMENT_IN` / `ADJUSTMENT_OUT`.

2. **Escalas decimales** (D2). `InventoryBalance.quantity` = `Decimal(18,4)`;
   `InventoryBalance.averageCost` = `Decimal(18,6)`; `InventoryMovement.quantity` /
   `baseQuantity` / `previousQuantity` / `resultingQuantity` = `Decimal(18,4)`;
   `InventoryMovement.unitCost` = `Decimal(18,6)?`. Cierra el pendiente de la sección 28
   para inventario. 4 decimales de cantidad coinciden con `QUANTITY_PATTERN`
   (`@ferreteria/validation`); 6 de costo dan holgura para cadenas de promedio ponderado
   (el ejemplo `L. 10.6667` de la sección 13 tiene 4). En la API las cantidades y el dinero
   viajan como **cadena** normalizada (sin ceros de relleno), nunca `number` (AGENTS.md §11-12).

3. **`baseQuantity` con signo** (D3). El movimiento guarda el efecto sobre el inventario
   con signo: positivo entra, negativo sale. `previousQuantity` y `resultingQuantity` son
   snapshots del saldo en unidad base antes y después — el kardex reconstruye "cómo se
   llegó al saldo actual" (RN-025) sin recomputar.

4. **`InventoryBalance` — restricción y creación** (D4). `@@unique([tenantId, productId])`
   (como máximo un balance por producto y tenant para V1). Se crea:
   - de forma **anticipada** dentro de la transacción de `POST /products`
     (`ProductsService.create` → `InventoryService.ensureBalanceWithinTx`), fiel al flujo
     docs/05 §9 ("Crear InventoryBalance inicial = 0");
   - de forma **perezosa** en cualquier operación de dominio, con
     `INSERT ... ON CONFLICT DO NOTHING` (mismo patrón que `TenantProductSequence`), lo que
     cubre los productos de la Fase 4 y el seed.

5. **Concurrencia** (D5). `InventoryService` (vía `recordMovementWithinTx`):
   1. `ensureBalanceWithinTx`; 2. `SELECT ... FOR UPDATE` de la fila del balance **dentro de
   la transacción**; 3. calcular saldo resultante; 4. **rechazar si quedaría < 0**
   (`INSUFFICIENT_STOCK`, 422); 5. recalcular costo si la entrada trae costo; 6. actualizar
   balance; 7. registrar el movimiento. El bloqueo pesimista serializa a los concurrentes:
   el segundo `SELECT ... FOR UPDATE` espera al COMMIT del primero y lee el saldo ya
   actualizado (docs/07 §17). Test de concurrencia real en `test/inventory.e2e-spec.ts`.
   Esta lógica está **centralizada**: Compras y Ventas la reutilizarán
   (`increaseWithinTx` / `decreaseWithinTx` / `adjustWithinTx`) en su propia transacción
   grande, sin reimplementar stock.

6. **`averageCost` es la fuente de verdad del costo** (D6). `Product` **no** tiene ningún
   campo de costo (decisión §45 D4). En Compras, `computeWeightedAverage(prevQty, prevAvg,
   inQty, inCost)` (`inventory.core.ts`, docs/07 §19: `prevQty <= 0` ⇒ `inCost`) se aplicará
   **dentro de la transacción** de completar la compra pasando `unitCost` a
   `increaseWithinTx`. La infraestructura ya existe y está probada.

7. **Un ajuste NO toca `averageCost`** (D7). El ajuste corrige cantidad, no valoración. El
   `InventoryMovement` del ajuste guarda el `averageCost` vigente como `unitCost` (snapshot
   de trazabilidad). `ADJUSTMENT_OUT` tampoco cambia el costo.

8. **Cambio manual de costo: implementado** (D8). `POST /inventory/products/:id/cost`,
   permiso `products.change_cost` (RP-025). Como Compras aún no existe, es la única vía de
   valorar la existencia actual. Motivo obligatorio; audita `PRODUCT_COST_CHANGED`
   (`{ previousCost, newCost, reason }`); **no** genera movimiento ni altera la existencia;
   es una operación de dominio, nunca un PATCH libre del balance (MD-006). El flujo
   docs/05 §13 queda cubierto.

9. **`inventory.adjust_approve` reservado** (D9). No hay flujo de doble aprobación en V1
   (docs/03 §14). `InventoryAdjustment.approvedById` existe (nullable) para ese futuro; el
   permiso queda en el catálogo sin endpoint. Crear un ajuste requiere solo
   `inventory.adjust`.

10. **Sin `Feature` ni límite de plan** (D10). Inventario es núcleo, igual que productos
    (§45.8). Solo permisos: `inventory.read` (consulta), `inventory.kardex` (kardex),
    `inventory.adjust` (ajuste), `products.change_cost` (costo). `inventory.export` queda
    reservado.

11. **`onDelete`** (D11): `Restrict` hacia `Tenant`, `Product`, `Unit` y (en
    `InventoryAdjustment`) hacia `InventoryMovement`; `InventoryMovement.user` y
    `InventoryAdjustment.approvedBy` no aplican `SetNull` porque `userId` de movimiento es
    `SetNull` y `createdBy` es `Restrict` (el actor de un ajuste no se pierde).

## 46.3 Endpoints y permisos

```text
GET  /inventory                                inventory.read
GET  /inventory/products/:productId            inventory.read
GET  /inventory/products/:productId/kardex     inventory.kardex
POST /inventory/adjustments                    inventory.adjust
POST /inventory/products/:productId/cost       products.change_cost
```

El listado soporta paginación, búsqueda por producto (`internalCode`/`barcode`/`name`),
filtro de estado del producto y filtro `stock` (`all`/`with`/`without`), siempre acotado al
tenant activo. El kardex soporta producto, rango de fechas (`from`/`to`), tipo de movimiento
y paginación. Un producto de otro tenant devuelve **404**.

## 46.4 Códigos de error nuevos

`apps/api/src/common/errors.ts`: `INSUFFICIENT_STOCK` (422) — una salida o ajuste negativo
dejaría `resultingQuantity < 0` (RN-022, RF-064); la validación definitiva ocurre dentro de
la transacción. Es el ejemplo canónico de AGENTS.md §26 / docs/07 §24.

## 46.5 Vocabulario de auditoría nuevo

`apps/api/src/audit/audit-actions.ts`: `INVENTORY_ADJUSTED` (entityType `InventoryAdjustment`),
`PRODUCT_COST_CHANGED` (entityType `Product`). Ambos son ejemplos literales de la sección 25.
El `InventoryMovement` es trazabilidad operacional; el `AuditLog` cubre además la acción
administrativa. Ambos se escriben dentro de la misma transacción que la operación (docs/05 §56).

---

# 47. Apéndice — Decisiones de implementación (Fase 6: proveedores y compras)

Esta fase materializó `Supplier`, `Purchase`, `PurchaseItem` y el enum
`PurchaseStatus` (sección 39, bloque *Compras*). Backend en
`apps/api/src/suppliers/` y `apps/api/src/purchases/`; frontend en
`apps/web/src/app/app/proveedores/` y `.../compras/`. **No** se implementaron
ventas, clientes, caja, créditos ni reportes.

## 47.1 Reutilización de inventario (sin duplicar lógica)

`CompletePurchaseUseCase` **no reimplementa** stock ni costo: llama a
`InventoryService.increaseWithinTx` (Fase 5) dentro de su propia transacción
grande. Ese primitivo hace `ensureBalance` -> `SELECT ... FOR UPDATE` ->
`computeWeightedAverage` -> actualizar balance -> crear `InventoryMovement`
(docs/04 §46 D5/D6, docs/07 §17-19). La cancelación llama a
`decreaseWithinTx` (type `REVERSAL`, `unitCost` nulo: no toca el costo).
`apps/api/src/purchases/purchases.core.ts` solo aporta las reglas puras
específicas de compra (conversión de línea, totales de cabecera).

## 47.2 Decisiones sobre puntos abiertos (RN-101)

1. **`Supplier.isActive` (booleano), no `status` enum** (D1). El prompt de la
   fase lo pidió explícito; el resto del catálogo tenant-owned usa
   `CatalogStatus`, pero un proveedor solo tiene dos estados y nunca participa
   en cálculos. Sin borrado físico (RF-072): `deactivate` marca
   `is_active = false`. `POST /suppliers/:id/activate` reutiliza el permiso
   `suppliers.deactivate` (no existe `suppliers.activate` en docs/03; mismo
   precedente que Category/Brand con `products.update`, §45.3).

2. **`@@unique([tenantId, name])` en `Supplier`** (D2). La documentación no lo
   pedía. Se añade por integridad de datos (mismo patrón que Category/Brand);
   `name` es no nulo, sin problema de NULLs. Código de error
   `SUPPLIER_NAME_TAKEN` (409).

3. **Nombres de actores en `Purchase`** (D3): `createdByUserId`,
   `completedByUserId`, `cancelledByUserId` (fieles al prompt). `onDelete`:
   `Restrict` en `createdBy`; `SetNull` en los dos nullables.

4. **Semántica de `PurchaseItem.unitCost`** (D4). Es el costo de **una unidad
   capturada**: si la línea usa presentación, el costo de la presentación
   completa (p. ej. L 250 por bolsa de 50 lb); si no, el costo por unidad base.
   Antes de tocar inventario el backend calcula
   `unitBaseCost = unitCost / conversionFactor` (250 / 50 = L 5 / lb) y **ese**
   valor alimenta el promedio ponderado. `PurchaseItem` guarda ambos
   (`unitCost`, `unitBaseCost`) más `conversionFactor` y `baseQuantity`
   congelados al completar, para no depender del catálogo actual después
   (docs/04 950-953).

5. **Totales — el backend es la autoridad** (D5, AGENTS.md 18, RF-082). El DTO
   **no acepta** `subtotal` ni `total` (con `forbidNonWhitelisted` enviarlos es
   400). `discount` y `tax` son de cabecera y entran del cliente (no hay tasa
   fija — docs/04 §29). `subtotal = suma de subtotales de línea`;
   `total = subtotal - discount + tax`; se rechaza `total < 0`
   (`BUSINESS_RULE_VIOLATION`). Todo se recalcula al completar a partir de los
   items persistidos.

6. **Escalas decimales** (D6): `Purchase.{subtotal,discount,tax,total}` y
   `PurchaseItem.{quantity,baseQuantity,subtotal}` = `Decimal(18,4)`;
   `PurchaseItem.{conversionFactor,unitCost,unitBaseCost}` = `Decimal(18,6)`
   (coherente con `ProductPresentation.conversionFactor` e
   `InventoryBalance.averageCost`). Cantidades y dinero viajan como **cadena**
   en la API (AGENTS.md 11-12).

7. **`documentNumber` único por tenant** (D7).
   `@@unique([tenantId, documentNumber])`; Postgres permite múltiples NULL
   (mismo patrón que `Product.barcode`). Cumple docs/04 1352-1368. Código
   `PURCHASE_DOCUMENT_TAKEN` (409).

8. **Producto inactivo en una compra** (D8). RN-009: un producto inactivo no
   admite nuevas operaciones. `resolveItems` exige `status = ACTIVE` **tanto al
   crear/editar el borrador como al completar**. Si un producto se desactiva
   entre el borrador y la finalización, completar falla con
   `INVALID_PURCHASE_ITEM` (422) y hace rollback total.

9. **Doble finalización / doble cancelación** (D9, RF-171, AGENTS.md 10, 21).
   `complete` y `cancel` abren transacción y hacen
   `SELECT id, status FROM purchases ... FOR UPDATE` (`lockPurchaseWithinTx`,
   mismo patrón que `lockBalanceWithinTx`). El estado se valida **dentro** de
   la transacción: una segunda petición concurrente espera al COMMIT de la
   primera, lee `COMPLETED`/`CANCELLED` y recibe 409
   (`PURCHASE_NOT_DRAFT` / `PURCHASE_NOT_COMPLETED`). Ninguna entrada de
   inventario se aplica dos veces.

10. **Política de costo al cancelar** (D10). docs/05 §19 pedía "recalcular costo
    según política definida" sin definirla. **Definición V1** (fiel al prompt):
    la cancelación es una **salida compensatoria** (`REVERSAL`) que reduce la
    cantidad y **no** recalcula retrospectivamente el `averageCost` de las
    operaciones posteriores. El movimiento guarda el `averageCost` vigente como
    snapshot. Si tras la compra hubo otras entradas con distinto costo, el
    promedio queda aproximado hasta que una operación futura lo reajuste; se
    prioriza integridad y trazabilidad sobre exactitud retroactiva (docs/02
    §22-23). docs/05 §19 se actualiza en el mismo cambio.

11. **Cancelación que dejaría stock negativo** (D11). Antes de revertir, cada
    línea intenta `decreaseWithinTx`; si `resultingQuantity < 0` el primitivo
    lanza `INSUFFICIENT_STOCK` y se traduce a
    `PURCHASE_CANCELLATION_STOCK_CONFLICT` (422). **No se inventa stock
    negativo**: la compra sigue `COMPLETED`, no hay cambios, y el mensaje pide
    resolver la situación con los flujos de inventario apropiados (ejemplo del
    prompt: compra +100, venta 90, cancelar requeriría -100).

12. **Sin `Feature` ni límite de plan** (D12). Compras es núcleo, igual que
    productos e inventario. Solo permisos:
    `suppliers.{read,create,update,deactivate}`,
    `purchases.{read,create,update,complete,cancel}` (docs/03 509-549). No se
    tocaron las plantillas de rol: `PURCHASES_MANAGER` ya trae todo menos
    `purchases.cancel` y `suppliers.deactivate` (docs/03 §18); `MANAGER` y
    `OWNER` los tienen.

13. **Auditoría** (D13). `PURCHASE_COMPLETED` y `PURCHASE_CANCELLED` se escriben
    dentro de la transacción de su operación (docs/05 §56; RF-140 exige auditar
    "compra cancelada"). También se auditan `PURCHASE_CREATED` /
    `PURCHASE_UPDATED` y `SUPPLIER_CREATED/UPDATED/ACTIVATED/DEACTIVATED` por
    consistencia con Productos. El `InventoryMovement` es la trazabilidad
    operacional (`referenceType = 'PURCHASE'`, `referenceId = purchaseId`).

## 47.3 Endpoints y permisos

```text
GET    /suppliers                  suppliers.read
POST   /suppliers                  suppliers.create
GET    /suppliers/:id              suppliers.read
PATCH  /suppliers/:id              suppliers.update
POST   /suppliers/:id/deactivate   suppliers.deactivate
POST   /suppliers/:id/activate     suppliers.deactivate

GET    /purchases                  purchases.read      (paginación, from/to, supplierId, status, search por documento)
POST   /purchases                  purchases.create    (nace DRAFT)
GET    /purchases/:id              purchases.read
PATCH  /purchases/:id              purchases.update    (solo DRAFT; reemplaza items)
POST   /purchases/:id/complete     purchases.complete
POST   /purchases/:id/cancel       purchases.cancel    (motivo obligatorio)
```

Un recurso de otro tenant devuelve **404** (no filtra su existencia).

## 47.4 Códigos de error nuevos

`apps/api/src/common/errors.ts`: `SUPPLIER_NAME_TAKEN` (409),
`SUPPLIER_INACTIVE` (422), `PURCHASE_NOT_DRAFT` (409),
`PURCHASE_NOT_COMPLETED` (409), `PURCHASE_EMPTY` (422),
`INVALID_PURCHASE_ITEM` (422), `PURCHASE_CANCELLATION_STOCK_CONFLICT` (422),
`PURCHASE_DOCUMENT_TAKEN` (409).

---

# 48. Apéndice — Decisiones de implementación (Fase 7: clientes y ventas)

Esta fase materializó `Customer`, `Sale`, `SaleItem`, `SalePayment` y el enum
`SaleStatus` (sección 39, bloque *Ventas*), más la **infraestructura mínima**
de `CreditAccount`/`CreditMovement` (sección 39, bloque *Créditos*) necesaria
para que una venta al crédito quede correctamente identificada, sin adelantar
el módulo completo de Créditos (cobros, estados de cartera, reportes).
Backend en `apps/api/src/customers/` y `apps/api/src/sales/`; frontend en
`apps/web/src/app/app/clientes/` y `.../ventas/`. **No** se implementaron caja,
créditos completos ni reportes.

## 48.1 Reutilización de inventario (sin duplicar lógica)

`CompleteSaleUseCase` **no reimplementa** stock ni concurrencia: llama a
`InventoryService.decreaseWithinTx` (Fase 5) dentro de su propia transacción
grande. Ese primitivo hace `ensureBalance` -> `SELECT ... FOR UPDATE` ->
rechazar si `resultingQuantity < 0` (`INSUFFICIENT_STOCK`) -> actualizar
balance -> crear `InventoryMovement` tipo `SALE` (docs/04 §46 D5, docs/07
§17-19, §46). La cancelación llama a `increaseWithinTx` (type `REVERSAL`, sin
recalcular el promedio: mismo primitivo, misma política que compras — §47.1).
`apps/api/src/sales/sales.core.ts` solo aporta las reglas puras específicas de
venta (conversión de línea, totales de cabecera).

## 48.2 Decisiones sobre puntos abiertos (RN-101)

1. **Cliente general: fila real, no `customerId = null`** (D1). RF-091 dice
   "las ventas de contado podrán utilizar un cliente genérico"; RF-092 dice
   "una venta a crédito no podrá asociarse al cliente general". Ambas reglas
   solo son comprobables si el cliente general es una fila identificable, así
   que se prefirió esa lectura sobre la de §18.1 ("el cliente puede ser
   `null`") — ver la corrección en §18.1. `Customer.isGeneralCustomer`
   (booleano) marca la fila; único por tenant vía el índice parcial
   `customer_one_general_per_tenant` (mismo procedimiento que
   `product_one_default_presentation` / `subscription_one_active_per_tenant`:
   no expresable en el schema de Prisma). `Sale.customerId` es **NOT NULL**.
   El cliente general se crea de forma perezosa (`GET /customers/general`) si
   el tenant aún no lo tiene — cubre tenants provisionados antes de esta fase
   — y también lo siembra el seed de desarrollo
   (`apps/api/src/catalog/customer-catalog.ts`, mismo patrón que
   `unit-catalog.ts`).

2. **El cliente general no se desactiva ni recibe crédito** (D2,
   `GENERAL_CUSTOMER_PROTECTED`, 422). No está documentado explícitamente, pero
   se sigue por integridad: desactivarlo dejaría sin cliente de contado por
   defecto, y un límite de crédito sobre él sería indistinguible de "crédito
   sin cliente", justo lo que RF-092 prohíbe.

3. **Precio siempre resuelto del backend; sin `unitPrice` en el DTO** (D3,
   RN-015, AGENTS.md 4/18). `SaleItemDto` solo acepta `productId`,
   `presentationId` opcional y `quantity`: con `forbidNonWhitelisted`, enviar
   `unitPrice` o `discount` de línea es 400. Si no se envía `presentationId`,
   el backend usa la presentación `isDefault` activa del producto; si el
   producto no tiene ninguna, `INVALID_SALE_ITEM` (422). El precio y el nombre
   de producto/presentación se **congelan** en `SaleItem` al completar
   (`productName`, `presentationName`, `unitPrice`) para no depender del
   catálogo actual después (docs/04 950-953). El descuento o precio manual por
   línea queda **fuera de esta fase**: exigiría un permiso propio que la
   documentación no define (mismo criterio que RF-113, D8 más abajo); mientras
   tanto `SaleItem.discount` existe en el esquema con `default 0` pero la API
   no lo acepta.

4. **Descuento e impuesto de cabecera** (D4, mismo patrón que compras — §47.2
   D5). `subtotal = suma de subtotales de línea`; `total = subtotal - discount
   + tax`; se rechaza `total < 0` (`BUSINESS_RULE_VIOLATION`). No hay tasa fija
   de impuesto (docs/04 §29): `tax` es un monto de cabecera que entra del
   cliente, igual que en compras.

5. **Costo histórico: `unitBaseCost`/`unitCost` en `SaleItem`** (D5). El prompt
   de la fase pedía "`averageCostAtSale` o `costSnapshot`"; se usó la misma
   pareja que `PurchaseItem` (§47.2 D4) por consistencia: `unitBaseCost` es el
   `InventoryBalance.averageCost` vigente **en el momento de completar**
   (tomado del `MovementResult` que devuelve `decreaseWithinTx` — una salida
   nunca recalcula el promedio, así que es exactamente el costo vigente) y
   `unitCost = unitBaseCost * conversionFactor` (costo de una unidad de la
   presentación vendida). Ambos quedan `NULL` mientras la venta es `DRAFT` y se
   congelan al completar; una compra o ajuste posterior que mueva el promedio
   **no** los reescribe (verificado en `sales.e2e-spec.ts`).

6. **Costo al cancelar: `REVERSAL` con el promedio como snapshot, no
   recalculado** (D6, mismo criterio que §47.2 D10 y §46 D7). La entrada
   compensatoria de una cancelación llama a `increaseWithinTx` sin forzar un
   costo de entrada propio: `recordMovementWithinTx` no encuentra
   `unitCost` que recalcular, así que el `averageCost` del producto **no
   cambia**, y el movimiento guarda el `averageCost` vigente como snapshot de
   trazabilidad (igual que en toda entrada sin costo propio — §46 D7). El
   costo histórico de la venta original sigue viviendo, intacto, en
   `SaleItem.unitCost`/`unitBaseCost`.

7. **`SalePayment` separado de `Sale`; regla de "pago único" en el caso de
   uso, no en el modelo** (D7, docs/04 §19.1). El modelo admite varios pagos
   futuros sin rehacer `Sale`; V1 solo permite completar con un pago:
   `CompleteSaleDto.amount` es opcional y, si se envía, debe coincidir EXACTO
   con el total recalculado (`SALE_PAYMENT_MISMATCH`, 422); si se omite, se usa
   el total. Split payments no se implementó en la UI (fuera de alcance de
   esta fase).

8. **Venta CREDIT: infraestructura mínima de crédito, no el módulo completo**
   (D8). RF-106/RF-112 exigen que una venta CREDIT valide el límite y genere
   un movimiento de crédito; docs/04 §39 ya lista `CreditAccount` y
   `CreditMovement` como entidades V1. Se implementó exactamente esa pareja
   (sin endpoints de cobro/ajuste, que son de la fase de Créditos):
   - la venta exige la feature de plan `CREDITS` (`FeatureService.assert`,
     orden de AGENTS.md §6: Feature antes que la regla de negocio) y rechaza
     el cliente general (`CREDIT_REQUIRES_CUSTOMER`, 422 — RF-092);
   - `lockOrCreateCreditAccountWithinTx` crea la cuenta si no existe
     (`INSERT ... ON CONFLICT DO NOTHING`, mismo patrón que
     `ensureBalanceWithinTx`) y la bloquea (`SELECT ... FOR UPDATE`) dentro de
     la transacción de la venta;
   - se valida `saldo + total <= creditLimit` (RF-112) antes de crear
     `CreditMovement(SALE, +total)` y actualizar `balance`/`status`;
   - al cancelar, `CreditMovement(ADJUSTMENT, -total)` revierte el saldo; si
     dejaría el saldo negativo, `CREDIT_CANCELLATION_CONFLICT` (422) — no
     puede ocurrir en V1 porque no hay abonos todavía, pero la validación
     queda lista para cuando existan;
   - `CreditAccountStatus` en esta fase solo distingue `PENDING` (saldo > 0)
     de `PAID` (saldo = 0): `PARTIAL` (con abonos) llega con el endpoint de
     abonos.
   - El permiso para exceder el límite de crédito (RF-113) **no se
     implementa**: su código sigue sin definir en la documentación (§44.2);
     exceder el límite siempre se rechaza.

9. **Permiso de completar: `sales.create`, no `sales.complete`** (D9,
   docs/05 §25 lo dice literal: "## Permiso `sales.create`"). El catálogo de
   docs/03 §16 no tiene `sales.complete` ni `sales.update`; los 70 permisos
   están fijados por test (`permissions.catalog.spec.ts`), así que no se
   inventan. `PATCH /sales/:id` y `POST /sales/:id/complete` comparten
   `sales.create`.

10. **Caja: no se toca en esta fase** (D10). RF-104 condiciona el ingreso de
    caja a que "exista sesión de caja aplicable"; RN-034/RF-102 dicen "afectar
    caja cuando corresponda"/"si aplica". Una venta `CASH` únicamente crea su
    `SalePayment`; no se crea `CashMovement` (el modelo de Caja — `CashRegister`
    /`CashSession`/`CashMovement` — todavía no existe). Cuando se implemente
    Caja, la conexión es agregar un paso más dentro de la misma transacción de
    `complete`, sin tocar lo ya construido aquí.

11. **`documentNumber` opcional, sin generación automática** (D11, mismo
    patrón que `Purchase` — §47.2 D7). `@@unique([tenantId, documentNumber])`;
    Postgres permite múltiples NULL. No se inventa un prefijo: docs/04 §27 y
    §36 se contradicen entre sí (`FAC-` vs `VENT-`) y no hay todavía una
    entidad de numeración configurable (§44.3 lo deja pendiente). Código
    `SALE_DOCUMENT_TAKEN` (409).

12. **Doble finalización / doble cancelación** (D12, RF-171, AGENTS.md §10/21,
    mismo patrón que compras — §47.2 D9). `complete` y `cancel` hacen
    `SELECT id, status FROM sales ... FOR UPDATE` (`lockSaleWithinTx`) y
    validan el estado **dentro** de la transacción: una segunda petición
    concurrente espera al COMMIT de la primera y recibe 409
    (`SALE_NOT_DRAFT` / `SALE_NOT_COMPLETED`).

13. **Sin `Feature` ni límite de plan propios de Ventas/Clientes** (D13).
    Ventas y Clientes son núcleo, igual que Productos/Inventario/Compras.
    Únicamente la venta CREDIT consulta la feature `CREDITS` (D8). No se
    tocaron las plantillas de rol: `CASHIER` ya trae
    `customers.{read,create}` y `sales.{read,create}` (docs/03 §14); `MANAGER`
    y `OWNER` tienen el resto (`customers.update/deactivate`,
    `sales.cancel/refund/export`).

14. **Auditoría** (D14). `SALE_COMPLETED` y `SALE_CANCELLED` se escriben dentro
    de la transacción de su operación (docs/05 §56; RF-140/RN-078 exigen
    auditar "venta cancelada"). También se auditan `SALE_CREATED`/
    `SALE_UPDATED` y `CUSTOMER_CREATED/UPDATED/ACTIVATED/DEACTIVATED/
    CREDIT_LIMIT_CHANGED` por consistencia con Productos y Compras. El
    `InventoryMovement` es la trazabilidad operacional
    (`referenceType = 'SALE'`, `referenceId = saleId`); el `CreditMovement`
    cumple el mismo papel para el efecto de crédito.

## 48.3 Inconsistencias detectadas en la documentación (RN-101, no se perpetúan)

- **`customerId` nulo (§18.1) vs. "cliente genérico" (RF-091/RF-092)**: resuelto
  a favor de una fila real de cliente general — ver D1 y la corrección en §18.1.
- **Prefijo de `documentNumber` de venta**: §27 usa `FAC-`, §36 usa `VENT-`. No
  se elige ninguno; el campo queda libre hasta que se apruebe un esquema de
  numeración (ver D11 y §44.3).
- **`SaleItem.tax`/`total` de §18.2**: la sección lista `tax` y `total` por
  línea, pero ninguna otra fase (incluida Compras) modela impuesto ni total por
  línea — solo de cabecera (D4). No se implementan en `SaleItem`; el impuesto
  vive únicamente en `Sale.tax`.
- **`CashMovementType` `SALE`/`INCOME`**: §21.3 nombra el valor de enum `SALE`;
  §22 y docs/05 §25/§26 lo describen como "`CashMovement(INCOME)`" en prosa. No
  aplica todavía (D10, caja fuera de esta fase), pero queda anotado para cuando
  se implemente Caja.

## 48.4 Endpoints y permisos

```text
GET    /customers                    customers.read
GET    /customers/general            customers.read   (cliente general; perezoso)
POST   /customers                    customers.create
GET    /customers/:id                customers.read
PATCH  /customers/:id                customers.update
POST   /customers/:id/deactivate     customers.deactivate
POST   /customers/:id/activate       customers.deactivate
POST   /customers/:id/credit-limit   credits.change_limit

GET    /sales                  sales.read      (paginación, from/to, customerId, status, search por documento)
POST   /sales                  sales.create    (nace DRAFT; customerId opcional -> cliente general)
GET    /sales/:id              sales.read
PATCH  /sales/:id              sales.create    (solo DRAFT; reemplaza items)
POST   /sales/:id/complete     sales.create    (docs/05 §25)
POST   /sales/:id/cancel       sales.cancel    (motivo obligatorio)
```

Un recurso de otro tenant devuelve **404** (no filtra su existencia).

## 48.5 Códigos de error nuevos

`apps/api/src/common/errors.ts`: `CUSTOMER_NAME_TAKEN` (409),
`CUSTOMER_INACTIVE` (422), `GENERAL_CUSTOMER_PROTECTED` (422),
`SALE_NOT_DRAFT` (409), `SALE_NOT_COMPLETED` (409), `SALE_EMPTY` (422),
`INVALID_SALE_ITEM` (422), `SALE_DOCUMENT_TAKEN` (409),
`SALE_PAYMENT_MISMATCH` (422), `CREDIT_REQUIRES_CUSTOMER` (422),
`CREDIT_LIMIT_EXCEEDED` (422), `CREDIT_CANCELLATION_CONFLICT` (422).

## 48.6 Vocabulario de auditoría nuevo

`apps/api/src/audit/audit-actions.ts`: `CUSTOMER_CREATED/UPDATED/ACTIVATED/
DEACTIVATED`, `CUSTOMER_CREDIT_LIMIT_CHANGED` (entityType `Customer`),
`SALE_CREATED/UPDATED/COMPLETED/CANCELLED` (entityType `Sale`). El
`InventoryMovement` y el `CreditMovement` son trazabilidad operacional; el
`AuditLog` cubre además la acción administrativa. Todos se escriben dentro de
la misma transacción que la operación (docs/05 §56).
