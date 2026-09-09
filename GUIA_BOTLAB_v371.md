# Onyx Bot Lab — v371

Cambios de esta entrega (marketplace de robots).

## 1. Pago con tarjeta reactivado (Stripe)
- El pago con tarjeta vuelve, controlado por el ajuste `pay_card` (Admin → Bot Lab → Comisión y cobros).
- Toda la copia del landing, FAQ y dashboard es condicional: si `pay_card` está apagado se muestra “solo USDT”; si está encendido, aparece “USDT o tarjeta”.

## 2. No puedes comprar tu propio robot + búsqueda/filtros
- El checkout rechaza que el creador compre su propio robot.
- Marketplace (landing y dashboard) con buscador + filtro de plataforma + orden + “cargar más”.

## 3. Referidos del vendedor (link + reparto + captura)
- En el formulario de venta el creador fija un **% de referido** (0–80% de su neto).
- En el marketplace del dashboard, cualquiera (menos el propio creador) ve **“Compartir y ganar X%”** que copia `/bot-lab?p=<id>&ref=<su-id>`.
- El landing público propaga el `ref` al dashboard y este lo guarda hasta la compra.
- Reparto por venta: **Onyx (comisión) → vendedor (neto) → referido (% del neto)**.
- Las ganancias por referir se muestran en **Ganancias** y se suman al saldo retirable.

## 4. Panel del gráfico + candado de parámetros (constructor)
- Nueva sección **“Panel en el gráfico”**: mostrar/ocultar, esquina (4 posiciones) y separación X/Y. Aplica a MT5, MT4 y cTrader.
- **“Bloquear parámetros del núcleo”**: al activarlo, la estrategia (entradas, SL/TP, riesgo y filtros) se hornea como constantes en el robot generado; el comprador solo puede pegar su clave Onyx y mover el panel. Ideal para vender.

## 5. Pagos al creador/referido por USDT o Stripe Express
- En **Ganancias**, el creador elige cómo cobrar: **USDT** (wallet TRC20/ERC20) o **banco vía Stripe Express** (requiere conectar el cobro).
- El saldo disponible incluye comisiones propias **y** ganancias por referir.

## 6. Academia oficial "Onyx Bot Lab" (solo admin)
- En **Admin → Bot Lab → (Comisión/Ajustes)** aparece la tarjeta **"Academia Onyx Bot Lab (oficial)"**.
- Botón **"Crear academia oficial"** (solo el dueño): crea/marca UNA academia a tu nombre dentro de Academy, con nombre "Onyx Bot Lab".
- Queda **destacada primero** en el directorio público de academias (`/academias`) con la marca oficial, y solo tú la administras (cursos, comunidad, eventos) desde `/dashboard/academy`. Enlace público: `/academia/<code>`.

## Migraciones SQL (ejecutar en Supabase, en orden)
1. `supabase/botlab_fee_per_trader.sql` — comisión por trader (si no se corrió antes).
2. `supabase/botlab_seller_referrals.sql` — `bot_products.affiliate_pct`, `crypto_payments.referrer_id`, `bot_purchases.referrer_id`, tabla `bot_referrals` (índice único `referrer_id,ref`).
3. `supabase/academy_official.sql` — `mentors.is_official` (+ índice único parcial: una sola oficial).

No hay columnas nuevas para el panel/candado: viajan dentro del `spec` del robot del constructor (JSON), sin cambios de esquema.

## Nota
Los 6 puntos de esta tanda quedan implementados y compilando (esbuild limpio).
