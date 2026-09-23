# Ventas · Impulso 1.er mes + residual + Guía (v556)

## Qué se agregó

### 1) Modelo de compensación "Impulso 1.er mes + residual"
El motor de comisiones (`lib/sales.ts`) ahora paga un **% alto el primer pago** de cada
cliente nuevo y un **% menor recurrente** del 2.º mes en adelante.

- `boost_first_month` (on/off).
- `first_direct_rate`, `first_override1_rate`, `first_override2_rate` → % del **primer mes**.
- Del 2.º mes en adelante se usan los % normales de la sección **Comisiones**.
- `pctFor(...)` recibe `firstMonth`; `creditFromPayment` lo pasa como `firstPay` (primer pago del cliente).

### 2) Bono primeras ventas (retención de arranque)
- `first_sales_count` → número de clientes de pago para ganarlo.
- `first_sales_bonus` → monto fijo en $.
- Se acredita **una sola vez por vendedor** (fila `level='bonus_first'` en `sales_commissions`),
  con la misma retención/mínimo que cualquier comisión. 0 en cualquiera lo desactiva.

### 3) Panel Admin → Ventas → Ajustes
Nueva tarjeta **"Impulso 1.er mes + residual"** con el interruptor, los 3 % del primer mes,
el bloque de **Bono primeras ventas** y un ejemplo en vivo (primer mes vs. recurrente vs. total anual).

### 4) Guía flotante de Ventas (igual que la de Anuncios)
Botón **"Abrir guía"** en la cabecera de Ventas. 8 pasos con dibujo y ejemplo:
cómo funciona el motor, Impulso 1.er mes, Bono primeras ventas, Comisiones/overrides,
La red, Metas y leaderboard, Crecimiento (ascensos/leads) y Pagos. Cada paso salta a la
pestaña correcta y la ilumina con una flecha.

## Base de datos
**No requiere SQL nuevo.** Los ajustes viven en `app_settings` (JSON) y el bono usa la
tabla `sales_commissions` existente.

## Al desplegar
Conserva tu propio `.env` (este ZIP **no** incluye archivos `.env`, solo los `.env.*.example`).
Activa el impulso desde Admin → Ventas → Ajustes y ajusta los %.
