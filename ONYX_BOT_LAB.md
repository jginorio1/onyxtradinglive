# Onyx Bot Lab — guía de activación

Marketplace de robots + servicios a medida + pagos con tarjeta y USDT.
Todo en el MISMO dominio (`/bot-lab`) y la MISMA base de datos (Supabase). Reusa el
Stripe Connect que ya tienes de la academia/copy y el Onyx Score.

## 1. Base de datos (una sola vez)
En Supabase → SQL Editor, ejecuta el archivo:

    supabase/botlab.sql

Crea: `bot_products`, `bot_purchases`, `bot_commissions`, `bot_service_requests`,
`bot_payouts`, `crypto_payments`, y añade a `profiles`: `bot_stripe_account_id`,
`bot_charges_enabled`, `bot_seller`, `payout_method`, `payout_usdt_address`.

## 2. Variables de entorno (opcionales)
- `ONYX_ACADEMY_FEE_PCT` — ya existe; NO afecta al Bot Lab (su comisión se
  configura en el panel).
- `BOTLAB_WEBHOOK_SECRET` — opcional. Si lo pones, crea un webhook de Stripe
  apuntando a `/api/webhooks/botlab` (eventos: `checkout.session.completed`,
  `customer.subscription.deleted`, `invoice.payment_failed`, `charge.refunded`).
  Sin él, la compra igual se activa al volver el usuario (confirmSession).

## 3. Cómo funciona
### Caminos
1. Construir (DIY) → tu `/bot-builder` de siempre (Nivel 1).
2. Comprar un robot listo → Marketplace.
3. Servicios a medida → "Automatiza tu estrategia" e "Instalación asistida".

### Pagos
- **Tarjeta**: robots oficiales cobran a tu cuenta; robots de creadores usan
  Stripe Connect (destination charge) y Onyx retiene su comisión automáticamente.
- **USDT**: modo manual. Se muestra tu wallet, el cliente paga y pega el hash; un
  admin confirma en el panel → se activa el robot. (Preparado para enganchar un
  procesador cripto automático más adelante.)

### Vender (creador)
El trader publica un robot → queda "en revisión" → tú lo apruebas en el panel →
se muestra en el Marketplace. Cobra por él (tarjeta) o recibe USDT. Se queda el
80% (comisión editable). Puede pedir retiro cuando junta ≥ $10.

## 4. Panel de administración
Admin → grupo "Producto" → **Onyx Bot Lab**. Ahí:
- Ajustes: comisión %, wallet USDT + red, precios de los servicios.
- Robots por revisar: aprobar / rechazar / verificar.
- Pagos USDT por confirmar: confirmar / rechazar (activa la licencia al confirmar).
- Solicitudes de servicio (leads): cambia su estado (nuevo → contactado → en curso…).
- Pagos a creadores: marcar como pagado.

## 5. Dónde lo ve el trader
- Público: `/bot-lab` (menú "Bot Lab").
- Dentro: `/dashboard/bot-lab` (menú "Onyx Bot Lab") con 3 pestañas:
  Marketplace · Mis robots · Vender y ganar.

## 6. Configura primero
1. En Admin → Onyx Bot Lab → Ajustes: pon tu **wallet USDT** y su **red** (trc20/erc20/bep20),
   la **comisión** (por defecto 20%) y los **precios de servicios**.
2. Publica 1–2 robots oficiales (seller vacío = Onyx oficial) para que el
   Marketplace no salga vacío.
3. (Opcional) Configura el webhook de Stripe para renovaciones/cancelaciones.

Nada de esto necesita dominio nuevo ni base de datos nueva.
