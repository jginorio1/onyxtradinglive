# Onyx v372 · Automatización de pagos de Bot Lab + clawback en Bot Lab y Embajadores

Esta versión cierra las fugas de dinero y automatiza los pagos a creadores/referidos, con
frenos para que tú siempre tengas el control. Además añade el **clawback** (recuperar el
dinero ya pagado) cuando hay reembolso o contracargo tardío — en **Bot Lab** y en **Embajadores**.

## 1) Aplica el SQL (una vez)

En Supabase → SQL Editor, corre `supabase/botlab_payout_safety.sql`. Añade:

- `bot_commissions`: `affiliate_cents`, `available_at`, `payout_id`, `reversed_at`.
- `bot_referrals`: `available_at`, `payout_id`.
- `bot_payouts`: `transfer_id`, `currency`.
- `commissions` (embajador): `reversed_at` + índice por `invoice_id`.

Es idempotente (`add column if not exists`): puedes correrlo sin miedo.

## 2) Qué cambió (dinero seguro)

**Fuga del referido — corregida.** Antes el creador cobraba el neto completo Y el referidor
cobraba su parte, así que Onyx pagaba de más. Ahora el % del referido se descuenta del neto
del creador (`affiliate_cents`). Nadie cobra de más.

**Maduración (anti-reembolso).** El saldo de una venta no se puede retirar hasta que "madura"
(por defecto 14 días). En el panel del creador verás **Disponible** (ya maduró, retirable) y
**En espera** (aún madurando). Así, si el cliente pide reembolso, el dinero todavía no salió.

**Tarjeta = saldo de plataforma.** Los cobros con tarjeta ahora entran al saldo de Onyx (no
por destination charge). Desde ese saldo salen las transferencias a los creadores, con fondos
garantizados.

**Pago automático por Stripe (cron).** Con el interruptor encendido, el cron
`/api/cron/botlab-payouts` (diario, 10:00 UTC) paga SOLO el saldo maduro a los creadores con
banco conectado. USDT nunca se automatiza: lo envías tú a mano en "Pagos USDT".

**Frenos.**
- **Revisar antes de pagar**: congela TODOS los pagos (incluye el cron). Los retiros quedan en cola.
- **Mínimo para pagar**: no se paga por debajo de ese monto (por defecto $10 / 1000 centavos).

**Clawback por reembolso/contracargo.** Si un cliente pide reembolso:
- Si la comisión/referido **aún no se pagó** → se anula.
- Si **ya se pagó** → se revierte la transferencia Stripe (en Embajadores, solo el monto de
  esa comisión, no todo el pago que pudo cubrir varias). Si la cuenta del creador no tiene
  saldo, queda marcado como deuda a compensar del próximo pago.

Esto aplica en Bot Lab (`app/api/webhooks/botlab` → `charge.refunded`) y en Embajadores
(`app/api/stripe/webhook` → `charge.refunded`).

## 3) Dónde se controla (Admin → Bot Lab → Ajustes)

Nueva tarjeta **"Pagos automáticos a creadores"**:
- Maduración del saldo (días)
- Mínimo para pagar (centavos)
- Auto-pagar por Stripe (cron) — on/off
- 🛑 Freno: revisar antes de pagar — on/off

El tope % de referido del vendedor sigue en la tarjeta "Comisión y cobros".

## 4) Cron en Vercel

Ya está en `vercel.json`: `/api/cron/botlab-payouts` a las 10:00 UTC. Protégelo con
`CRON_SECRET` (cabecera `Authorization: Bearer …` o `?key=…`). Vercel lo llama solo.

## 5) Verificación

Todos los archivos tocados compilan (esbuild, sin errores):
`lib/botlab.ts`, `lib/ambassadorPayout.ts`, sell route, ambos webhooks, cron, admin route,
`app/admin/BotLab.tsx`, `app/dashboard/bot-lab/page.tsx`.
