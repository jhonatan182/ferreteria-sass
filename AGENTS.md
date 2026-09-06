# AGENTS.md

Este archivo contiene reglas obligatorias para Claude Code, Codex y cualquier otro agente que trabaje en el proyecto.

---

## 1. Leer antes de implementar

Revisar en este orden:

1. `docs/00-DISEÑO-SAAS.md`
2. `docs/01-VISION-Y-ALCANCE.md`
3. `docs/02-REGLAS-DEL-NEGOCIO.md`
4. `docs/03-ROLES-Y-PERMISOS.md`
5. `docs/04-MODELO-DE-DOMINIO.md`
6. `docs/05-FLUJOS-OPERATIVOS.md`
7. `docs/06-REQUERIMIENTOS-FUNCIONALES.md`
8. `docs/07-ARQUITECTURA-TECNICA.md`

No implementar una funcionalidad importante sin revisar sus reglas relacionadas.

---

## 2. Stack obligatorio

- TypeScript.
- Next.js.
- NestJS.
- PostgreSQL.
- Prisma.
- REST.
- Monorepo.

No introducir C#/.NET.

---

## 3. Multi-tenancy

El sistema es SaaS multi-tenant.

Nunca escribir código suponiendo una única empresa.

Toda entidad tenant-owned debe respetar tenant.

---

## 4. Regla de seguridad principal

Nunca confiar en valores enviados por el frontend para determinar:

- tenant;
- usuario;
- rol;
- permisos;
- totales;
- costo;
- stock;
- estado interno.

El backend es la autoridad.

---

## 5. Queries tenant-aware

Nunca ejecutar una query tenant-owned únicamente por ID.

Incorrecto:

```ts
findUnique({ where: { id } })
```

si esto puede permitir acceso cruzado.

La consulta debe incorporar/verificar `tenantId`.

---

## 6. Orden de autorización

```text
Authentication
-> Membership
-> Tenant
-> Subscription
-> Feature
-> Limit
-> Permission
-> Resource ownership
-> Business rules
```

---

## 7. Inventario

Nunca hacer:

```ts
product.stock = value
```

Toda modificación debe pasar por una operación de dominio y un movimiento.

---

## 8. Ventas

Completar una venta debe ser atómico.

Debe incluir en una sola transacción los efectos aplicables:

- venta;
- items;
- inventario;
- pago;
- crédito;
- caja;
- auditoría.

---

## 9. Compras

Completar compra debe ser atómico.

Debe incluir:

- compra;
- items;
- inventario;
- costo;
- datos de pago;
- auditoría cuando corresponda.

---

## 10. Doble ejecución

Nunca permitir que `complete`, `cancel`, `close` o equivalentes se ejecuten dos veces sobre la misma entidad.

Validar estado dentro de la transacción.

---

## 11. Dinero

Nunca usar `float`.

Usar decimal/numeric.

---

## 12. Cantidades

No asumir enteros.

Ferretería puede vender fracciones.

---

## 13. Créditos

Los movimientos son la trazabilidad principal.

No implementar crédito solamente con un campo mutable `balance`.

---

## 14. Caja

Usar:

- `CashRegister`;
- `CashSession`;
- `CashMovement`.

Un cierre es inmutable.

---

## 15. No borrar historial crítico

Nunca eliminar físicamente:

- ventas completadas;
- compras completadas;
- movimientos de inventario;
- movimientos de crédito;
- movimientos de caja;
- cierres;
- auditoría.

---

## 16. Correcciones

Usar:

- cancelación;
- devolución;
- ajuste;
- movimiento compensatorio.

---

## 17. API de dominio

Preferir:

```text
POST /sales/:id/complete
```

sobre:

```text
PATCH /sales/:id { status: "COMPLETED" }
```

para cambios de estado que produzcan efectos.

---

## 18. Totales

Los totales definitivos se recalculan en backend.

No confiar en totales enviados por UI.

---

## 19. Planes

Nunca hardcodear comportamiento por nombre del plan.

Incorrecto:

```ts
if (plan === "PREMIUM")
```

Usar features y límites.

---

## 20. Suscripciones

Estados:

- ACTIVE
- PAST_DUE
- SUSPENDED
- CANCELLED

Grace period inicial: 7 días.

Pagos SaaS: manuales en V1.

---

## 21. Concurrencia

La validación crítica debe ocurrir dentro de la transacción.

Especial atención a:

- stock;
- cierre de caja;
- doble finalización;
- doble cancelación;
- abonos duplicados.

---

## 22. Migraciones

Todo cambio de Prisma Schema requiere migración.

No modificar DB de producción manualmente como procedimiento normal.

---

## 23. Dependencias

Antes de instalar una dependencia:

1. comprobar si realmente se necesita;
2. revisar mantenimiento;
3. revisar seguridad;
4. revisar si el stack ya resuelve el caso.

No agregar librerías innecesariamente.

---

## 24. Sobreingeniería prohibida

No introducir sin necesidad demostrada:

- microservicios;
- Kafka;
- Kubernetes;
- event sourcing;
- CQRS completo;
- service mesh;
- Redis obligatorio.

---

## 25. Testing obligatorio

Cada operación crítica debe probar:

- happy path;
- permiso denegado;
- tenant incorrecto;
- estado inválido;
- regla de negocio;
- rollback cuando falle;
- duplicación/idempotencia cuando aplique.

---

## 26. Errores

Usar códigos funcionales estables.

Ejemplo:

```json
{
  "code": "INSUFFICIENT_STOCK",
  "message": "No hay existencia suficiente."
}
```

---

## 27. Código

Preferir código:

- explícito;
- pequeño;
- tipado;
- testeable;
- mantenible.

Evitar abstracciones prematuras.

---

## 28. Documentación

Si una implementación cambia una regla acordada, actualizar el `.md` correspondiente en el mismo cambio.

Código y documentación no deben divergir.

---

## 29. Decisiones no definidas

Si una decisión falta:

1. revisar todos los documentos;
2. preferir la opción más segura y simple;
3. preservar integridad y trazabilidad;
4. documentar la decisión.

No inventar reglas fiscales, legales o tributarias.

---

## 30. Orden de prioridad

Ante conflicto:

```text
Seguridad
-> Integridad
-> Reglas de negocio
-> Trazabilidad
-> Mantenibilidad
-> Rendimiento
-> Conveniencia
```

---

## 31. Definition of Done

Una tarea se considera terminada cuando, según corresponda:

- compila;
- lint pasa;
- tests pasan;
- respeta tenant;
- respeta permisos;
- respeta plan;
- maneja errores;
- usa transacción;
- audita;
- tiene migración;
- documentación está actualizada.
