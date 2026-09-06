# 01 — Visión y Alcance

**Versión:** 1.0  
**Estado:** Base aprobada para implementación  
**Fecha:** 2026-09-05

---

## 1. Visión

Construir una plataforma SaaS especializada en ferreterías que permita controlar las operaciones principales del negocio de forma sencilla, trazable y segura.

La plataforma debe sustituir controles dispersos en papel, Excel o sistemas parciales, consolidando la operación comercial y administrativa.

---

## 2. Objetivo principal

Permitir que una ferretería gestione el ciclo:

```text
Producto
  ->
Compra
  ->
Inventario
  ->
Venta
  ->
Pago / Crédito
  ->
Caja
  ->
Reportes
```

sin perder trazabilidad de quién hizo cada operación y cómo afectó al negocio.

---

## 3. Objetivos específicos

- Administrar catálogo de productos.
- Manejar presentaciones y unidades.
- Controlar inventario mediante kardex.
- Registrar compras.
- Registrar ventas.
- Administrar clientes.
- Administrar proveedores.
- Manejar ventas al crédito.
- Registrar abonos.
- Controlar apertura y cierre de caja.
- Generar reportes.
- Administrar usuarios.
- Administrar roles y permisos.
- Aislar datos por tenant.
- Administrar planes y suscripciones SaaS.

---

## 4. Usuarios objetivo

### Plataforma

- propietario del SaaS;
- equipo de soporte futuro;
- administración comercial futura.

### Ferretería

- propietario;
- gerente;
- cajero/vendedor;
- encargado de inventario;
- encargado de compras.

---

## 5. Alcance V1

### 5.1 SaaS

- tenants;
- usuarios;
- membresías;
- planes;
- features;
- límites;
- suscripciones;
- períodos;
- pagos SaaS manuales;
- suspensión;
- reactivación;
- auditoría de plataforma.

### 5.2 Seguridad

- autenticación;
- autorización;
- roles;
- permisos;
- aislamiento por tenant;
- auditoría.

### 5.3 Productos

- productos;
- categorías;
- marcas;
- unidades;
- presentaciones;
- precios;
- costo;
- activación/desactivación.

### 5.4 Inventario

- existencia;
- kardex;
- entradas;
- salidas;
- ajustes;
- reversión por operaciones relacionadas.

### 5.5 Compras

- borradores;
- proveedor;
- detalle;
- finalización;
- impacto en inventario;
- costo ponderado;
- cancelación.

### 5.6 Ventas

- borradores;
- cliente;
- detalle;
- cobros;
- crédito;
- finalización;
- impacto en inventario;
- cancelaciones;
- devoluciones básicas.

### 5.7 Clientes y proveedores

- alta;
- edición;
- desactivación;
- historial asociado.

### 5.8 Caja

- apertura;
- movimientos;
- cierre;
- diferencias;
- historial.

### 5.9 Créditos

- límite;
- saldo;
- movimientos;
- abonos;
- ajustes;
- estados.

### 5.10 Reportes

- ventas;
- compras;
- inventario;
- caja;
- créditos;
- utilidad básica.

---

## 6. Fuera de alcance de V1

- contabilidad general completa;
- libro mayor;
- conciliación bancaria automática;
- facturación electrónica oficial;
- pasarela de pagos SaaS;
- cobros automáticos;
- aplicación móvil nativa;
- RRHH;
- planilla;
- multi-sucursal avanzada;
- marketplace;
- e-commerce;
- microservicios;
- integraciones bancarias.

---

## 7. Futuras fases

### Fase futura A

- facturación electrónica;
- proveedores de pago;
- notificaciones;
- exportaciones avanzadas.

### Fase futura B

- RRHH;
- planilla;
- asistencia.

### Fase futura C

- multi-sucursal;
- bodegas;
- transferencias entre sucursales.

---

## 8. Principios de UX

La interfaz debe priorizar:

- rapidez;
- pocos pasos;
- formularios claros;
- mensajes entendibles;
- evitar términos técnicos;
- acciones críticas claramente diferenciadas;
- confirmación en cancelaciones/devoluciones;
- búsqueda rápida de productos;
- navegación consistente.

---

## 9. Principios de negocio

1. El historial financiero no se borra.
2. El inventario no se modifica directamente.
3. Caja no equivale a ventas.
4. Crédito no equivale a caja.
5. Una venta completada es un hecho comercial.
6. Una compra completada es un hecho de inventario/costo.
7. Las correcciones se realizan mediante operaciones compensatorias.
8. Los totales se calculan en backend.
9. El tenant es parte de la seguridad.
10. El plan comercial no reemplaza los permisos.

---

## 10. Criterio de éxito de V1

La V1 será utilizable cuando un tenant pueda:

1. iniciar sesión;
2. crear usuarios;
3. registrar productos;
4. registrar proveedores;
5. completar una compra;
6. verificar inventario;
7. abrir caja;
8. crear clientes;
9. completar una venta;
10. registrar venta al crédito;
11. registrar abono;
12. cerrar caja;
13. consultar reportes;
14. rastrear las operaciones mediante auditoría.

---

## 11. Restricción operativa inicial

El primer tenant probablemente tendrá pocos usuarios simultáneos.

Esto permite priorizar:

- simplicidad;
- bajo costo;
- confiabilidad;
- facilidad de mantenimiento.

No justifica sacrificar multi-tenancy ni integridad transaccional.
