# Onyx Bot Lab v2 — Coinbase USDT + avisos + chat traducido + centro de mando

## 1. Base de datos
Ejecuta (una vez, tras `botlab.sql`):

    supabase/botlab_v2.sql

Crea las tablas del chat (`botlab_threads`, `botlab_messages`) y añade `hosted_url` a `crypto_payments`.

## 2. Variables de entorno
- `COINBASE_COMMERCE_API_KEY` — cobro USDT automático. Sin ella, el pago cae a modo manual (wallet + hash).
- `COINBASE_COMMERCE_WEBHOOK_SECRET` — para confirmar pagos on-chain.
- `ANTHROPIC_API_KEY` — ya la tienes; se usa para traducir el chat. Sin ella, el chat funciona pero sin traducir.

En Coinbase Commerce → Settings → Webhook subscriptions, apunta el webhook a:

    https://www.onyxtradinglive.com/api/webhooks/coinbase

## 3. Pagos: solo USDT (Coinbase)
- El trader compra un robot → se crea un charge en Coinbase → paga en USDT → Coinbase confirma y el robot se activa **solo** (webhook). Se quitó la tarjeta en Bot Lab.
- Sin Coinbase configurado: se muestra tu wallet USDT (Admin → Ajustes) y el cliente pega el hash; tú confirmas en Admin → Pagos USDT.

## 4. Avisos de propuestas
Cuando entra una solicitud de servicio (Automatiza / Instalación / Elite):
- Te llega un **correo** a la dirección que pongas en Admin → Onyx Bot Lab → Ajustes → "Correo de avisos" (por defecto, el primero de `ADMIN_EMAILS`). Sale desde `botlab@onyxtradinglive.com`.
- Si pones un **chat de Telegram** en Ajustes, también te avisa por ahí.
- Todas quedan en Admin → Onyx Bot Lab → Servicios.

## 5. Chat con traducción automática
- El cliente ve un chat flotante dorado en las páginas de Bot Lab. Escribe en **su idioma**.
- Tú lo ves y respondes en **español** desde Admin → Onyx Bot Lab → **Chat**.
- El cliente **recibe tu respuesta en su idioma**. Guardamos original + español.

## 6. Centro de mando (admin)
Admin → Onyx Bot Lab, con sub-pestañas: **Resumen · Marketplace · Servicios · Pagos USDT · Creadores · Chat · Ajustes**.

## 7. Iconos
Se reemplazaron los emojis por iconos SVG de línea (landing y dashboard).

## Cómo separarlo de Onyx / soporte
Mismo login y base de datos; canales aparte: correo `botlab@`, chat propio con traducción (el soporte del trading no se mezcla), y su propio libro de pagos/comisiones.

## Para el futuro (high-ticket escalable)
- Anticipo del 50% en el servicio a medida (charge de Coinbase por el depósito).
- Paquetes premium con entregables claros + retainer mensual (VPS + monitoreo) = ingreso recurrente.
- CRM de propuestas (nuevo → contactado → en curso → ganado) — ya está el estado en Servicios.
- Reseñas verificadas y track record atado al Onyx Score para vender confianza.
