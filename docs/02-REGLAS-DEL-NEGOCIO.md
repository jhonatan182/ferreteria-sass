# Reglas del Negocio — Sistema SaaS para Ferreterías

**Versión:** 1.0  
**Estado:** Aprobado  
**Tipo:** Especificación de reglas de negocio  
**Última actualización:** 2026-09-05

---

# 1. Propósito

Este documento define las reglas de negocio que deben cumplirse en el sistema de gestión para ferreterías.

Estas reglas son independientes de la tecnología utilizada para implementarlas.

El sistema será desarrollado como una plataforma SaaS multi-tenant, permitiendo administrar múltiples ferreterías desde una misma plataforma.

Las reglas aquí definidas deben ser respetadas por:

- Backend
- Frontend
- Base de datos
- Procesos automáticos
- Integraciones futuras
- Agentes de inteligencia artificial utilizados para desarrollar el sistema

Una implementación técnica no debe modificar una regla de negocio sin una decisión explícita del responsable del proyecto.

---

# 2. Principios generales

## RN-001 — Multi-tenancy

El sistema debe soportar múltiples tenants desde el inicio.

Cada tenant representa una empresa o ferretería independiente.

Los datos de un tenant nunca deben ser visibles, modificables ni eliminables por otro tenant.

---

## RN-002 — Aislamiento de datos

Todo dato perteneciente al negocio de un tenant debe estar asociado directa o indirectamente a dicho tenant.

Ejemplos:

- Productos
- Inventario
- Compras
- Ventas
- Clientes
- Proveedores
- Créditos
- Cajas
- Usuarios
- Configuraciones

---

## RN-003 — Identificación del tenant

El backend debe determinar el tenant a partir del contexto autenticado del usuario.

El frontend nunca debe poder seleccionar arbitrariamente el `tenantId` para acceder a información.

El `tenantId` enviado por el cliente no debe considerarse una fuente confiable.

---

## RN-004 — No existe lógica específica para un tenant

La aplicación no debe contener reglas como:

```text
if tenant == "Ferretería X"
```

ni comportamientos especiales codificados específicamente para un cliente.

Las diferencias entre tenants deben resolverse mediante:

- configuración
- permisos
- planes
- features
- límites
- parámetros del negocio

---

# 3. Productos

## RN-005 — Identificación del producto

Todo producto debe tener un identificador interno único dentro del sistema.

Además, puede tener un código interno visible para el negocio.

---

## RN-006 — Código interno

Todo producto debe poder tener un código interno generado por el sistema.

Ejemplo:

```text
FER-000001
FER-000002
FER-000003
```

El prefijo debe ser configurable por tenant.

El código interno no representa necesariamente un código de barras.

---

## RN-007 — Código de barras

Un producto puede tener un código de barras comercial.

El código de barras es opcional.

Cuando exista, debe ser único dentro del tenant.

---

## RN-008 — Código interno y código de barras son conceptos diferentes

El sistema debe diferenciar claramente:

```text
internalCode
barcode
```

Nunca se debe utilizar el término "código de barras" para referirse al código interno generado por el sistema.

---

## RN-009 — Estado del producto

Un producto puede estar:

```text
ACTIVE
INACTIVE
```

Un producto inactivo no debe poder utilizarse para nuevas operaciones de venta o compra, salvo que una operación histórica necesite consultarlo.

---

## RN-010 — Eliminación de productos

Los productos que hayan participado en operaciones históricas no deben eliminarse físicamente.

Deben marcarse como inactivos.

Esto permite conservar la integridad histórica.

---

# 4. Unidades y presentaciones

## RN-011 — Unidad base

Todo producto debe tener una unidad base para efectos de inventario.

Ejemplos:

```text
LIBRA
UNIDAD
METRO
LITRO
```

---

## RN-012 — Presentaciones

Un producto puede tener una o varias presentaciones comerciales.

Ejemplo:

```text
Producto: Cemento

Unidad base:
LIBRA

Presentaciones:
- Libra → 1
- Bolsa → 50
```

---

## RN-013 — Factor de conversión

Cada presentación debe tener un factor de conversión hacia la unidad base.

Ejemplo:

```text
1 Bolsa = 50 Libras
```

Por tanto:

```text
3 Bolsas = 150 Libras
```

---

## RN-014 — Inventario en unidad base

El inventario debe controlarse internamente en la unidad base del producto.

Las operaciones realizadas con presentaciones deben convertirse a la unidad base antes de afectar el inventario.

---

## RN-015 — Precio por presentación

Cada presentación puede tener su propio precio de venta.

El precio no debe calcularse obligatoriamente multiplicando el precio de la unidad base.

Ejemplo:

```text
Libra = L.5.00
Bolsa = L.220.00
```

---

## RN-016 — Presentación principal

Un producto debe poder tener una presentación principal para facilitar su uso en operaciones.

---

# 5. Costos

## RN-017 — Costo del producto

El sistema debe mantener información de costo para permitir posteriormente calcular márgenes y rentabilidad.

---

## RN-018 — Costo promedio

La estrategia inicial de valoración de inventario será costo promedio ponderado.

Cuando se realicen nuevas compras, el costo promedio podrá recalcularse según las cantidades y costos involucrados.

No se implementará FIFO/LIFO en la primera versión salvo decisión posterior.

---

# 6. Inventario

## RN-019 — Inventario basado en movimientos

El inventario debe estar respaldado por movimientos de inventario.

El sistema no debe depender únicamente de modificar directamente un campo de stock.

---

## RN-020 — Origen de los movimientos

Los movimientos de inventario pueden originarse por:

- Compras
- Ventas
- Devoluciones
- Ajustes
- Otras operaciones explícitamente autorizadas

---

## RN-021 — Trazabilidad

Todo movimiento de inventario debe registrar como mínimo:

- Producto
- Cantidad
- Unidad
- Cantidad en unidad base
- Tipo de movimiento
- Fecha
- Usuario
- Documento origen, cuando aplique
- Motivo, cuando aplique

---

## RN-022 — Inventario negativo

El sistema no permitirá inventario negativo por defecto.

Una venta que exceda el inventario disponible no podrá completarse.

---

## RN-023 — Ajustes de inventario

Los ajustes de inventario solamente podrán ser realizados por usuarios con el permiso correspondiente.

Todo ajuste debe registrar un motivo.

Ejemplos:

```text
Conteo físico
Producto dañado
Pérdida
Corrección de inventario
```

---

## RN-024 — No modificar stock directamente

Ninguna interfaz debe modificar directamente el stock.

Las modificaciones deben producirse mediante operaciones de dominio que generen movimientos de inventario.

---

## RN-025 — Kardex

El sistema debe permitir consultar el historial de movimientos de un producto.

El historial debe permitir conocer cómo se llegó al saldo actual.

---

# 7. Compras

## RN-026 — Compra

Una compra debe estar asociada a un proveedor.

Debe contener uno o más productos.

---

## RN-027 — Estados de compra

Una compra podrá encontrarse inicialmente en:

```text
DRAFT
COMPLETED
CANCELLED
```

---

## RN-028 — Compra en borrador

Una compra en estado `DRAFT` no debe afectar el inventario.

---

## RN-029 — Compra completada

Al completar una compra:

1. Se registra la operación.
2. Se genera la entrada de inventario.
3. Se actualiza el costo correspondiente.
4. Se registra la información de pago.

Estas operaciones deben ejecutarse de forma transaccional.

---

## RN-030 — Compra cancelada

Una compra completada no debe eliminarse físicamente.

Si debe revertirse, se debe cancelar y generar los movimientos necesarios para revertir sus efectos.

---

# 8. Ventas

## RN-031 — Venta

Una venta debe contener uno o más productos.

Puede estar asociada a un cliente o ser una venta de consumidor general.

---

## RN-032 — Estados de venta

Una venta podrá encontrarse inicialmente en:

```text
DRAFT
COMPLETED
CANCELLED
```

---

## RN-033 — Venta en borrador

Una venta en estado `DRAFT` no debe afectar:

- Inventario
- Caja
- Créditos
- Saldos financieros

---

## RN-034 — Completar venta

Al completar una venta el sistema debe:

1. Validar permisos.
2. Validar productos.
3. Validar cantidades.
4. Validar inventario.
5. Calcular los importes.
6. Registrar la venta.
7. Generar los movimientos de inventario.
8. Registrar el pago o crédito.
9. Afectar caja cuando corresponda.

La operación debe ser transaccional.

---

## RN-035 — Venta completada

Una venta completada no debe eliminarse físicamente.

Su información histórica debe conservarse.

---

## RN-036 — Cancelación de venta

Una venta completada puede cancelarse únicamente mediante una operación autorizada.

La cancelación debe revertir los efectos correspondientes:

- Inventario
- Caja
- Crédito
- Otros movimientos relacionados

La operación debe quedar registrada en auditoría.

---

# 9. Métodos de pago

## RN-037 — Métodos iniciales

El sistema debe soportar como mínimo:

```text
CASH
CARD
TRANSFER
CREDIT
```

La arquitectura debe permitir agregar otros métodos posteriormente.

---

## RN-038 — Método de pago no es estado de venta

El método de pago y el estado de la venta son conceptos independientes.

Ejemplo:

```text
Sale Status:
COMPLETED

Payment Method:
CARD
```

---

## RN-039 — Efectivo

Una venta pagada en efectivo incrementa el efectivo esperado de la caja.

---

## RN-040 — Tarjeta

Una venta pagada con tarjeta no incrementa el efectivo físico de la caja.

---

## RN-041 — Transferencia

Una venta pagada mediante transferencia no incrementa el efectivo físico de la caja.

---

## RN-042 — Venta a crédito

Una venta a crédito no registra dinero recibido inmediatamente.

Debe generar una cuenta por cobrar asociada al cliente.

---

# 10. Clientes

## RN-043 — Cliente

Los clientes deben pertenecer a un tenant.

Un cliente debe poder almacenar información básica como:

- Nombre
- Identificación, cuando aplique
- Teléfono
- Correo
- Dirección
- Estado

---

## RN-044 — Cliente general

El sistema debe permitir realizar ventas sin registrar un cliente específico cuando el negocio lo permita.

Las ventas a crédito siempre deben estar asociadas a un cliente.

---

# 11. Créditos

## RN-045 — Cuenta por cobrar

Las cuentas por cobrar deben estar asociadas a un cliente.

---

## RN-046 — Movimientos de crédito

El saldo de crédito debe estar respaldado por movimientos.

Como mínimo:

```text
SALE
PAYMENT
ADJUSTMENT
```

---

## RN-047 — Saldo

El saldo pendiente debe representar las obligaciones no pagadas del cliente.

Ejemplo:

```text
Venta      +L.2,500
Venta      +L.1,200
Pago       -L.1,000

Saldo       L.2,700
```

---

## RN-048 — Estados del crédito

Una cuenta de crédito puede estar:

```text
PENDING
PARTIAL
PAID
```

---

## RN-049 — Pago parcial

Si el cliente realiza un pago inferior al saldo pendiente, la cuenta permanece abierta y pasa a estado `PARTIAL`.

---

## RN-050 — Pago completo

Cuando el saldo pendiente llega a cero, el crédito pasa a `PAID`.

---

## RN-051 — Límite de crédito

El cliente puede tener un límite de crédito configurable.

El sistema debe validar el crédito disponible antes de completar una venta a crédito.

---

## RN-052 — Exceso de límite

Una venta que exceda el límite disponible debe ser rechazada salvo que el usuario tenga un permiso especial para autorizarla.

---

## RN-053 — Abonos

Todo abono debe registrar:

- Cliente
- Monto
- Fecha
- Usuario
- Método de pago
- Referencia, cuando corresponda
- Observación opcional

---

## RN-054 — Abono en efectivo

Un abono en efectivo incrementa el efectivo esperado de la caja.

---

## RN-055 — Abono mediante transferencia o tarjeta

Un abono realizado mediante transferencia o tarjeta no incrementa el efectivo físico de la caja.

---

# 12. Caja

## RN-056 — Caja

La caja representa el control del efectivo físico de una operación o turno.

---

## RN-057 — Estados de caja

Inicialmente:

```text
OPEN
CLOSED
```

---

## RN-058 — Apertura

Para abrir una caja se debe registrar un fondo inicial.

Ejemplo:

```text
Fondo inicial: L.1,000
```

---

## RN-059 — Una caja abierta

Una misma caja no debe tener múltiples aperturas activas simultáneamente para el mismo contexto operativo.

---

## RN-060 — Movimientos de caja

Los movimientos pueden ser:

### Ingresos

- Ventas en efectivo
- Abonos en efectivo
- Otros ingresos autorizados

### Egresos

- Gastos
- Retiros
- Devoluciones en efectivo
- Otros egresos autorizados

---

## RN-061 — Ventas no monetarias

Las ventas mediante:

```text
CARD
TRANSFER
CREDIT
```

no deben incrementar el efectivo físico de la caja.

---

## RN-062 — Cierre

Al cerrar la caja, el sistema debe calcular:

```text
Efectivo esperado =
Fondo inicial
+ ingresos
- egresos
```

El usuario debe registrar el efectivo físico contado.

---

## RN-063 — Diferencia de caja

El sistema debe calcular:

```text
Diferencia =
Efectivo real - Efectivo esperado
```

La diferencia debe conservarse como parte del cierre.

---

## RN-064 — Historial

Los cierres de caja no deben eliminarse.

Deben permanecer disponibles para consulta y auditoría.

---

# 13. Devoluciones

## RN-065 — Devolución

Una devolución debe referenciar la operación original cuando sea posible.

---

## RN-066 — Inventario de devolución

Cuando corresponda, una devolución de producto debe generar una entrada de inventario.

---

## RN-067 — Devolución monetaria

Cuando corresponda devolver dinero al cliente, debe registrarse el movimiento financiero correspondiente.

Si el dinero se devuelve en efectivo, debe afectar la caja.

---

## RN-068 — No modificar históricamente una venta

Una devolución no debe modificar arbitrariamente los registros históricos originales.

Debe existir como una operación relacionada.

---

# 14. Usuarios

## RN-069 — Usuario

Un usuario representa una identidad autenticada dentro de la plataforma.

---

## RN-070 — Membership

La relación entre usuario y tenant debe manejarse mediante una membresía.

Conceptualmente:

```text
User
  ↓
TenantMembership
  ↓
Tenant
```

Esto permite soportar en el futuro usuarios pertenecientes a más de un tenant.

---

## RN-071 — Estado del usuario

Los usuarios pueden estar activos o inactivos.

Un usuario inactivo no debe poder iniciar nuevas operaciones.

---

# 15. Roles y permisos

## RN-072 — Separación entre roles y permisos

Los roles y permisos son conceptos diferentes.

La relación será:

```text
User
  ↓
Role
  ↓
Permissions
```

---

## RN-073 — Permisos granulares

Los permisos deben representar acciones concretas.

Ejemplos:

```text
products.read
products.create
products.update
products.change_price

inventory.read
inventory.adjust

sales.read
sales.create
sales.cancel
sales.refund

purchases.read
purchases.create
purchases.cancel

credits.read
credits.collect

cash.open
cash.close
cash.expense

users.read
users.create
users.update

roles.manage
```

---

## RN-074 — Autorización en backend

Los permisos deben validarse obligatoriamente en el backend.

Nunca se debe confiar únicamente en las restricciones de la interfaz.

---

## RN-075 — Acciones críticas

Las siguientes operaciones deben requerir permisos específicos:

- Cancelar ventas
- Devolver dinero
- Ajustar inventario
- Modificar costos
- Modificar precios
- Cerrar caja
- Registrar ajustes de crédito
- Administrar usuarios
- Administrar roles y permisos

---

# 16. Auditoría

## RN-076 — Operaciones auditables

Las operaciones críticas deben registrar:

- Usuario
- Tenant
- Acción
- Entidad afectada
- Identificador de la entidad
- Fecha
- Información relevante de la operación

---

## RN-077 — Inventario

Los ajustes de inventario deben ser auditables.

---

## RN-078 — Ventas

Las cancelaciones y devoluciones deben ser auditables.

---

## RN-079 — Usuarios

Los cambios de permisos y roles deben ser auditables.

---

## RN-080 — Información histórica

La información histórica necesaria para comprender las operaciones del negocio no debe eliminarse físicamente.

---

# 17. Transacciones

## RN-081 — Operaciones transaccionales

Cuando una operación produzca múltiples efectos relacionados, todos deben ejecutarse dentro de una transacción.

Ejemplo:

```text
Completar venta
    ↓
Venta
    ↓
Inventario
    ↓
Pago
    ↓
Caja / Crédito
```

Si una parte falla, la operación completa debe revertirse.

---

# 18. Suscripciones SaaS

## RN-082 — Suscripción por tenant

Cada tenant debe tener una suscripción asociada.

---

## RN-083 — Plan

Una suscripción pertenece a un plan.

Los planes estarán definidos por la plataforma.

Ejemplos iniciales:

```text
BASIC
PROFESSIONAL
PREMIUM
```

Los nombres y precios son configurables y no deben estar hardcodeados en la lógica del sistema.

---

## RN-084 — Características del plan

Los planes pueden definir características habilitadas.

Ejemplos:

```text
CREDITS
CASH
ADVANCED_REPORTS
PAYROLL
```

---

## RN-085 — Límites

Los planes pueden definir límites.

Ejemplos:

```text
MAX_USERS
MAX_PRODUCTS
```

---

## RN-086 — Suscripción activa

Una suscripción activa permite al tenant utilizar las funcionalidades contratadas.

---

## RN-087 — Estados de suscripción

Inicialmente se utilizarán:

```text
ACTIVE
PAST_DUE
SUSPENDED
CANCELLED
```

---

## RN-088 — Pago manual

Durante la primera versión, los pagos de suscripción serán administrados manualmente por el administrador de la plataforma.

No se implementará inicialmente un proveedor de pagos automático.

---

## RN-089 — Registro de pago

Cada pago de suscripción debe registrarse individualmente.

No debe existir únicamente un campo:

```text
paid = true
```

---

## RN-090 — Periodos de suscripción

El sistema debe conservar información de los periodos de suscripción.

Debe ser posible conocer:

- Inicio del periodo
- Fin del periodo
- Pago asociado
- Estado
- Fecha de registro

---

## RN-091 — Vencimiento

Cuando finalice el periodo pagado y no exista renovación, la suscripción podrá pasar a:

```text
PAST_DUE
```

---

## RN-092 — Periodo de gracia

El sistema podrá otorgar un periodo de gracia después del vencimiento.

El periodo inicial propuesto es de:

```text
7 días
```

Este valor debe ser configurable.

---

## RN-093 — Suspensión

Después del periodo de gracia, la suscripción podrá pasar a:

```text
SUSPENDED
```

Un tenant suspendido no podrá realizar normalmente las operaciones del sistema.

---

## RN-094 — Conservación de datos

La suspensión de un tenant nunca debe eliminar sus datos.

Los siguientes datos deben conservarse:

- Productos
- Inventario
- Ventas
- Compras
- Clientes
- Proveedores
- Créditos
- Caja
- Usuarios
- Historial
- Auditoría

---

## RN-095 — Reactivación

Cuando el administrador de la plataforma registre correctamente un nuevo pago, la suscripción podrá volver a:

```text
ACTIVE
```

El tenant podrá continuar utilizando sus datos existentes.

---

## RN-096 — Administración de suscripciones

El administrador de la plataforma será responsable inicialmente de:

- Crear suscripciones
- Asignar planes
- Registrar pagos
- Extender periodos
- Suspender suscripciones
- Reactivar suscripciones

---

# 19. Administrador de plataforma

## RN-097 — Platform Admin

El administrador de la plataforma administra el SaaS, no una ferretería específica.

Puede administrar:

- Tenants
- Planes
- Suscripciones
- Pagos
- Configuración de plataforma
- Auditoría de plataforma

---

## RN-098 — Tenant Admin

El administrador de un tenant administra exclusivamente su ferretería.

No debe tener acceso a:

- Otros tenants
- Suscripciones de otros clientes
- Configuración global de la plataforma
- Información privada de otros negocios

---

# 20. Integridad de información

## RN-099 — No eliminar operaciones históricas

Las operaciones que hayan producido efectos financieros o de inventario no deben eliminarse físicamente.

---

## RN-100 — Correcciones mediante nuevas operaciones

Cuando sea necesario corregir una operación histórica, se debe preferir:

- Cancelación
- Devolución
- Ajuste
- Movimiento compensatorio

en lugar de modificar silenciosamente la información histórica.

---

# 21. Reglas de implementación para agentes de IA

Estas reglas no sustituyen las reglas técnicas de `AGENTS.md`, pero establecen límites funcionales.

## RN-101 — No inventar reglas

Si una funcionalidad nueva requiere una regla de negocio que no está definida, el agente no debe inventarla silenciosamente.

Debe identificar la decisión pendiente.

---

## RN-102 — No simplificar reglas críticas

El agente no debe reemplazar conceptos importantes por implementaciones simplificadas que rompan las reglas del negocio.

Ejemplo incorrecto:

```text
product.stock -= quantity
```

si la operación no genera el correspondiente movimiento de inventario.

---

## RN-103 — No modificar reglas aprobadas

Las reglas de este documento se consideran aprobadas.

Cualquier cambio debe realizarse explícitamente en la documentación antes de modificar la implementación.

---

# 22. Principio general del sistema

El sistema debe representar las operaciones reales del negocio.

Una operación importante debe poder responder:

```text
¿Qué ocurrió?
¿Quién lo hizo?
¿Cuándo ocurrió?
¿Por qué ocurrió?
¿Qué afectó?
¿Cuál era el estado anterior?
¿Cuál es el estado posterior?
```

La trazabilidad y consistencia de la información tienen prioridad sobre la simplicidad de una implementación puntual.

---

# 23. Regla de prioridad

Cuando exista conflicto entre:

1. Interfaz
2. Implementación actual
3. Regla de negocio

la regla de negocio tiene prioridad.

La implementación debe adaptarse a la regla de negocio.