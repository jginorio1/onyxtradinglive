# MatchTrader — conexión de cuentas de traders (Platform API retail)

Modelo de Onyx: cada trader conecta SU cuenta de SU bróker (FundedNext, etc.) con
su propio login. Se usa la **Platform API (retail)** de MatchTrader. Guardian y Copy
usan el mismo motor que MT4/MT5/cTrader. MatchTrader no lleva EA: todo es server-side.

## 1) Base de datos
En Supabase → SQL Editor corre: **`supabase/matchtrader_platform.sql`**
(crea el catálogo `mt_brokers` y añade las columnas de sesión retail; siembra FundedNext).

## 2) Variables de entorno (Vercel)
- `CRON_SECRET` — ya la tienes (protege el cron).
- `MATCHTRADER_ENC_KEY` — **recomendada**: clave hex de 64 caracteres para cifrar los
  tokens en reposo (AES-256-GCM). Generar: `openssl rand -hex 32`. Sin ella los tokens
  se guardan en texto (con RLS); con ella, cifrados.

## 3) Cron (ya en vercel.json)
`/api/cron/matchtrader` cada 2 min → refresca el token (cada ~15 min, respeta el
límite de la API), aplica Guardian y ejecuta la cola de Copy.

## 4) Admin: catálogo de brókers
Abre **`/admin/mt-brokers`** (solo admin). Añade cada bróker/prop firm:
- **Nombre** (p.ej. FundedNext)
- **URL base de la Platform API** del bróker. ¿Cómo obtenerla? Entra al **web trader**
  del bróker, abre **DevTools → Network**, y mira cualquier llamada: el dominio es la
  base (algo como `https://mtr.fundednext.com`). El `brokerId` y el `systemUuid` se
  obtienen solos (no hay que ponerlos).
- **Prop firm** → muestra el aviso de reglas al trader antes de conectar.
- **Permitir Copy / Activo**.
Al guardar, la app verifica que la URL responde (`/manager/platform-details`).

> FundedNext viene sembrado con `https://mtr.fundednext.com` — **verifica esa URL** con
> el método de arriba y corrígela si difiere.

## 5) Cómo conecta el TRADER (muy simple)
Dashboard → Conectar cuenta → MatchTrader:
1. Elige su **bróker** de la lista.
2. Pone su **email + contraseña** de esa cuenta.
3. Si el bróker es prop firm, sale un **aviso de reglas** (copy/automatización) y decide.
4. Onyx hace login, guarda **solo el token cifrado** (nunca la contraseña) y conecta
   todas las cuentas de trading de ese login. Guardian arranca; el trader activa **Copy**
   por cuenta con un interruptor.

## Cómo funciona por dentro
- **Auth**: `POST {base}/manager/mtr-login {email,password,brokerId}` → token de sesión
  (cookie `co-auth`) + `tradingApiToken` por cuenta. El token dura 15 min; el cron lo
  refresca cada ~15 min para mantener la sesión 24/7 sin volver a pedir la contraseña.
- **Trading**: `/mtr-api/{systemUuid}/position/open|close|edit|close-partially` con
  cabeceras `Auth-trading-api` + `Cookie: co-auth`.
- **Guardian**: lee posiciones + balance/equity y aplica `evaluate()`; si bloquea, cierra por API.
- **Copy máster**: diff de la foto anterior → encola en `copy_commands`.
- **Copy esclava**: el cron ejecuta la cola por API (abrir/cerrar/modificar).

## Seguridad
Solo se guarda el **token cifrado**. La contraseña se usa una vez al conectar y se
descarta. Si el token muere y no se puede refrescar, la conexión queda `reauth` y el
trader reconecta (vuelve a poner su contraseña una vez).

## Aviso importante (prop firms)
FundedNext y las prop firms suelen **prohibir copy trading y automatización por API**
en cuentas de challenge/fondeadas. El monitoreo (Guardian) es de bajo riesgo; **Copy**
queda a criterio del trader, con el aviso que sale antes de conectar.
