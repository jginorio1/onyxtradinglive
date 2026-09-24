# MatchTrader — integración completa (Guardian + Copy por API)

Integración **real** contra la Broker API de Match-Trader. Guardian y Copy usan el
MISMO motor que MetaTrader/cTrader; MatchTrader no lleva EA, todo es server-side.

## 1) Base de datos
Corre en Supabase → SQL Editor:
- `supabase/matchtrader.sql` (si no lo habías corrido)
- `supabase/matchtrader_v2.sql`  ← añade `login`, `role`, `master_snapshot`, `slave_ticket`

## 2) Variables de entorno (Vercel)
Obligatoria para el cron (ya la tienes): `CRON_SECRET`.

Opcionales:
- `MATCHTRADER_ENC_KEY` — clave hex de 64 caracteres (32 bytes) para **cifrar el token
  en reposo** (AES-256-GCM). Si la pones, los tokens se guardan cifrados; si no, se
  guardan en texto (RLS activa). Generar: `openssl rand -hex 32`.
- Rutas de la API si tu bróker usa otras (por defecto son las de la doc):
  `MATCHTRADER_PATH_OPEN` (/open-position), `MATCHTRADER_PATH_CLOSE` (/close-position),
  `MATCHTRADER_PATH_EDIT` (/edit-position), `MATCHTRADER_PATH_POSITIONS` (/open-positions),
  `MATCHTRADER_PATH_ACCOUNT` (/balance-snapshots).

## 3) Cron (ya añadido a vercel.json)
`/api/cron/matchtrader` cada 2 min → aplica Guardian y ejecuta la cola de Copy.

## 4) Conectar una cuenta (trader)
Dashboard → Conectar cuenta → MatchTrader. Se piden:
- **API URL (base)** — la base de la Broker API que te da el bróker (producción, no `-demo`).
- **Token del CRM (Bearer)** — token de la Broker API (Authentication → Bearer).
- **Login** — nº de la cuenta de trading (lo exigen todos los endpoints).
- **systemUuid** — identificador del sistema del bróker.
- **Rol en Copy** — Máster (emite), Esclava (recibe) o Ambas.

## Cómo funciona
- **Guardian**: el cron lee posiciones + equity/balance por API y aplica `evaluate()`;
  si la cuenta queda bloqueada, cierra por API lo que se abrió (igual que el EA).
- **Copy máster**: el cron compara la foto anterior con la actual → detecta aperturas y
  cierres y los pasa a `relayMasterSnapshot()`, que encola comandos en `copy_commands`.
- **Copy esclava**: como no hay EA, el propio cron **ejecuta** los comandos por API
  (open/close/edit) y guarda el ticket del bróker para poder cerrar esa misma posición.
  Lote: modo multiplicador (× del máster) con tope `max_lot`.

## Seguridad
Solo se guarda el **token del CRM** (cifrado si defines `MATCHTRADER_ENC_KEY`). Nunca se
guarda ni se pide la contraseña del trader. El token no se devuelve nunca al navegador.

## Pendiente de confirmar con Match-Trader (no bloquea)
- URL **base de producción** exacta del REST (la doc muestra la demo del gRPC).
- Si tu acceso es a nivel bróker (necesitas que la prop/bróker autorice tu `systemUuid`).
- Ruta exacta de "Get Open Positions" y de balance/equity si difieren de los defaults
  (se ajustan por env, sin tocar código).
