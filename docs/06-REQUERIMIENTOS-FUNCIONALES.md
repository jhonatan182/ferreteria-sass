# 06 — Requerimientos Funcionales

**Versión:** 1.0  
**Estado:** Base aprobada para implementación  
**Fecha:** 2026-09-05

---

## 1. Convenciones

Prioridades:

- **MUST:** obligatorio para V1.
- **SHOULD:** deseable después del núcleo.
- **COULD:** futura mejora.

---

# 2. Autenticación

## RF-001 — Iniciar sesión [MUST]

El sistema deberá permitir iniciar sesión con credenciales válidas.

### Resultado

El backend deberá conocer:

- `userId`;
- membresías activas;
- estado del usuario.

---

## RF-002 — Bloquear usuario inactivo [MUST]

Un usuario inactivo no podrá iniciar sesión ni ejecutar operaciones autenticadas.

---

## RF-003 — Seleccionar tenant [MUST]

Si un usuario pertenece a múltiples tenants, deberá seleccionar uno antes de operar.

El backend deberá comprobar la membresía al tenant seleccionado.

---

## RF-004 — Cerrar sesión [MUST]

El usuario podrá invalidar su sesión actual.

---

# 3. Autorización

## RF-010 — Validar permiso [MUST]

Toda operación protegida deberá validar su permiso correspondiente en backend.

---

## RF-011 — Aislar tenant [MUST]

Ninguna consulta o mutación podrá acceder a recursos pertenecientes a otro tenant.

---

## RF-012 — Denegar por defecto [MUST]

La ausencia de permiso explícito resultará en acceso denegado.

---

## RF-013 — Validar feature [MUST]

Cuando una operación pertenezca a una feature comercial, deberá verificarse que el plan del tenant la incluya.

---

## RF-014 — Validar límite [MUST]

Antes de crear recursos sujetos a límite, deberá comprobarse la capacidad disponible.

---

# 4. Tenants

## RF-020 — Crear tenant [MUST]

Platform Admin podrá crear un tenant.

Debe generarse:

- tenant;
- configuración inicial;
- membresía Owner;
- suscripción inicial cuando corresponda.

---

## RF-021 — Suspender tenant [MUST]

Platform Admin podrá suspender un tenant.

La suspensión no eliminará datos.

---

## RF-022 — Reactivar tenant [MUST]

Platform Admin podrá reactivar un tenant.

La acción deberá quedar auditada.

---

# 5. Usuarios

## RF-030 — Crear usuario [MUST]

Un usuario autorizado podrá crear usuarios dentro de su tenant.

Validaciones:

- límite de usuarios;
- identificador válido;
- rol permitido;
- tenant correcto.

---

## RF-031 — Editar usuario [MUST]

Permitirá modificar información no histórica.

---

## RF-032 — Desactivar usuario [MUST]

La desactivación impedirá acceso futuro sin alterar operaciones históricas.

---

## RF-033 — Asignar rol [MUST]

Permitirá asignar un rol a una membresía.

---

# 6. Roles y permisos

## RF-040 — Consultar roles [MUST]

Usuarios autorizados podrán consultar roles del tenant.

---

## RF-041 — Crear rol personalizado [SHOULD]

Owner podrá crear roles adicionales.

---

## RF-042 — Modificar permisos [SHOULD]

La modificación de permisos requerirá permiso crítico y auditoría.

---

# 7. Productos

## RF-050 — Crear producto [MUST]

Campos mínimos:

- nombre;
- código interno;
- unidad base;
- estado.

Opcionales:

- código de barras;
- descripción;
- categoría;
- marca.

---

## RF-051 — Generar código interno [MUST]

El sistema podrá generar códigos secuenciales por tenant.

Ejemplo:

```text
FER-000001
```

---

## RF-052 — Unicidad por tenant [MUST]

`internalCode` deberá ser único por tenant.

`barcode`, cuando exista, deberá ser único por tenant.

---

## RF-053 — Presentaciones [MUST]

Un producto podrá tener múltiples presentaciones.

Cada presentación podrá definir:

- nombre;
- unidad;
- factor de conversión;
- precio;
- presentación principal;
- estado.

---

## RF-054 — Unidad base [MUST]

Toda existencia se almacenará en unidad base.

---

## RF-055 — Precio por presentación [MUST]

Cada presentación podrá tener precio independiente.

---

## RF-056 — Desactivar producto [MUST]

Un producto con historial no podrá borrarse físicamente.

---

# 8. Inventario

## RF-060 — Consultar existencia [MUST]

El sistema mostrará la existencia actual por producto.

---

## RF-061 — Registrar movimientos [MUST]

Todo cambio de inventario deberá producir un `InventoryMovement`.

---

## RF-062 — Consultar kardex [MUST]

El kardex deberá mostrar:

- fecha;
- producto;
- tipo;
- cantidad;
- unidad base;
- usuario;
- documento origen;
- razón cuando aplique.

---

## RF-063 — Ajustar inventario [MUST]

Los ajustes requerirán:

- permiso;
- cantidad;
- motivo;
- usuario.

---

## RF-064 — Prohibir stock negativo [MUST]

Una salida no podrá completar si provoca stock negativo.

---

# 9. Proveedores

## RF-070 — Crear proveedor [MUST]

Permitirá registrar datos básicos del proveedor.

---

## RF-071 — Editar proveedor [MUST]

Permitirá modificar datos administrativos.

---

## RF-072 — Desactivar proveedor [MUST]

No se eliminarán proveedores con historial.

---

# 10. Compras

## RF-080 — Crear compra [MUST]

Una compra iniciará en `DRAFT`.

---

## RF-081 — Editar compra en borrador [MUST]

Un borrador podrá modificarse libremente dentro de las reglas de validación.

---

## RF-082 — Completar compra [MUST]

La operación deberá ejecutar atómicamente:

1. validar compra;
2. validar proveedor;
3. validar productos;
4. calcular importes;
5. guardar compra;
6. guardar items;
7. crear entradas de inventario;
8. actualizar costo ponderado;
9. registrar información de pago;
10. registrar auditoría cuando corresponda.

---

## RF-083 — Compra completada inmutable [MUST]

Una compra `COMPLETED` no podrá volver a editarse como borrador.

---

## RF-084 — Cancelar compra [MUST]

La cancelación deberá generar movimientos compensatorios.

No deberá borrar la compra original.

---

# 11. Clientes

## RF-090 — Crear cliente [MUST]

Campos:

- nombre;
- identificación opcional;
- teléfono;
- email;
- dirección;
- estado.

---

## RF-091 — Cliente general [MUST]

Las ventas de contado podrán utilizar un cliente genérico.

---

## RF-092 — Crédito requiere cliente específico [MUST]

Una venta a crédito no podrá asociarse al cliente general.

---

# 12. Ventas

## RF-100 — Crear venta [MUST]

Una venta iniciará en `DRAFT`.

---

## RF-101 — Editar borrador [MUST]

Podrán agregarse y eliminarse items mientras la venta permanezca en `DRAFT`.

---

## RF-102 — Completar venta [MUST]

La operación deberá ejecutar atómicamente:

1. validar usuario;
2. validar permiso;
3. validar estado;
4. validar cliente;
5. validar items;
6. validar presentaciones;
7. convertir cantidades a unidad base;
8. validar stock;
9. recalcular precios y totales;
10. registrar venta;
11. registrar items;
12. descontar inventario mediante movimientos;
13. registrar pagos;
14. registrar crédito si aplica;
15. registrar caja si aplica;
16. registrar auditoría cuando corresponda.

---

## RF-103 — Métodos de pago [MUST]

Soportará inicialmente:

- `CASH`
- `CARD`
- `TRANSFER`
- `CREDIT`

---

## RF-104 — Venta en efectivo [MUST]

Una venta CASH completada deberá generar ingreso de caja cuando exista sesión de caja aplicable.

---

## RF-105 — Tarjeta/transferencia [MUST]

No aumentarán el efectivo físico.

---

## RF-106 — Venta al crédito [MUST]

Debe:

- requerir cliente específico;
- validar límite;
- crear movimiento de crédito;
- no registrar ingreso físico de caja.

---

## RF-107 — Cancelar venta [MUST]

La cancelación:

- no borrará la venta;
- revertirá inventario;
- revertirá efectos financieros correspondientes;
- quedará auditada.

---

## RF-108 — Devolución [SHOULD]

Las devoluciones deberán ser operaciones independientes vinculadas a la venta original.

---

# 13. Créditos

## RF-110 — Cuenta de crédito [MUST]

Cada cliente podrá tener una cuenta de crédito.

---

## RF-111 — Movimiento de crédito [MUST]

Tipos iniciales:

- `SALE`
- `PAYMENT`
- `ADJUSTMENT`

---

## RF-112 — Límite de crédito [MUST]

Antes de completar una venta:

```text
saldo_actual + nueva_deuda <= limite_credito
```

---

## RF-113 — Exceder límite [MUST]

Solo podrá permitirse mediante permiso especial explícito.

---

## RF-114 — Registrar abono [MUST]

Debe almacenar:

- cliente;
- monto;
- fecha;
- usuario;
- método;
- referencia opcional;
- observación opcional.

---

## RF-115 — Impacto de caja por abono [MUST]

Un abono CASH aumentará caja.

CARD/TRANSFER no aumentarán efectivo físico.

---

## RF-116 — Estado de crédito [MUST]

Estados:

- `PENDING`
- `PARTIAL`
- `PAID`

El estado deberá corresponder al saldo y movimientos.

---

# 14. Caja

## RF-120 — Abrir caja [MUST]

La apertura requiere fondo inicial.

---

## RF-121 — Una sesión activa [MUST]

V1 permitirá una sola sesión activa por `CashRegister`.

---

## RF-122 — Registrar ingreso [MUST]

Permitirá ingresos autorizados independientes de ventas.

---

## RF-123 — Registrar egreso [MUST]

Permitirá egresos autorizados con razón.

---

## RF-124 — Registrar retiro [MUST]

Permitirá retirar efectivo sin confundirlo con un gasto comercial.

---

## RF-125 — Cerrar caja [MUST]

Calculará:

```text
esperado = fondo_inicial + ingresos - egresos - retiros
diferencia = efectivo_contado - esperado
```

---

## RF-126 — Cierre inmutable [MUST]

Una caja cerrada no se reabrirá ni editará.

Una corrección deberá producir una nueva operación administrativa explícita.

---

# 15. Reportes

## RF-130 — Reporte de ventas [MUST]

Filtros:

- período;
- estado;
- usuario;
- cliente;
- método de pago cuando aplique.

---

## RF-131 — Reporte de compras [MUST]

Filtros:

- período;
- proveedor;
- estado.

---

## RF-132 — Reporte de inventario [MUST]

Mostrará:

- producto;
- existencia;
- costo;
- valor aproximado de inventario.

---

## RF-133 — Kardex [MUST]

Permitirá revisar movimientos por producto y período.

---

## RF-134 — Reporte de caja [MUST]

Mostrará aperturas, movimientos, cierres y diferencias.

---

## RF-135 — Reporte de créditos [MUST]

Mostrará:

- cliente;
- límite;
- saldo;
- movimientos;
- estado.

---

## RF-136 — Utilidad básica [SHOULD]

Mostrará venta, costo y margen conforme al costo registrado.

---

# 16. Auditoría

## RF-140 — Registrar acción crítica [MUST]

Auditar como mínimo:

- cancelación de venta;
- devolución;
- cancelación de compra;
- ajuste de inventario;
- cambio de costo;
- cambio de precio;
- ajuste de crédito;
- cierre de caja;
- gestión de usuarios;
- gestión de roles;
- gestión de permisos;
- suspensión/reactivación de tenant;
- cambios de suscripción.

---

# 17. Planes y suscripciones

## RF-150 — Crear plan [MUST]

Platform Admin podrá administrar planes.

---

## RF-151 — Configurar features [MUST]

Los planes podrán habilitar capacidades.

---

## RF-152 — Configurar límites [MUST]

Los planes podrán establecer límites.

---

## RF-153 — Crear suscripción [MUST]

Platform Admin podrá asociar tenant y plan.

---

## RF-154 — Registrar pago manual [MUST]

Debe almacenar:

- suscripción;
- tenant;
- monto;
- fecha;
- referencia;
- usuario Platform Admin;
- período relacionado.

---

## RF-155 — Vencimiento [MUST]

Al finalizar el período:

```text
ACTIVE -> PAST_DUE
```

---

## RF-156 — Grace period [MUST]

Después del período de gracia:

```text
PAST_DUE -> SUSPENDED
```

---

## RF-157 — Reactivación [MUST]

Un pago o ajuste administrativo válido podrá establecer un nuevo período y reactivar la suscripción.

---

# 18. Integridad transaccional

## RF-160 — Atomicidad [MUST]

Toda operación multi-entidad crítica deberá ser atómica.

No deberá quedar una operación parcialmente aplicada.

---

# 19. Concurrencia

## RF-170 — Stock concurrente [MUST]

El sistema deberá impedir que ventas simultáneas consuman el mismo stock.

La validación definitiva deberá ocurrir dentro de la transacción.

---

## RF-171 — Idempotencia de finalización [MUST]

Solicitudes duplicadas para completar una misma venta o compra no deberán aplicar sus efectos dos veces.

El estado de la entidad y la transacción deben impedir doble finalización.

---

# 20. Manejo de errores

## RF-180 — Errores funcionales [MUST]

La API deberá diferenciar al menos:

- autenticación;
- autorización;
- validación;
- recurso inexistente;
- conflicto;
- regla de negocio;
- límite del plan;
- feature no disponible.

---

# 21. Criterios generales de aceptación

Una funcionalidad se considera terminada cuando:

1. tiene interfaz cuando corresponde;
2. tiene endpoint/caso de uso;
3. valida entrada;
4. valida tenant;
5. valida permisos;
6. valida plan cuando corresponda;
7. aplica reglas de negocio;
8. usa transacción cuando corresponda;
9. registra auditoría cuando corresponda;
10. maneja errores;
11. tiene pruebas relevantes.
