# Onyx Trading Live · Entornos (Producción / Beta / Stable)

Guía para tener **bases de datos separadas** y un flujo seguro de releases.

---

## La idea en una frase

El **mismo código** corre en dos sitios; lo único que cambia son las **variables de
entorno** (a qué Supabase y a qué Stripe apunta cada uno). **Beta** es donde pruebas;
**Producción** es lo que ven tus clientes. **"Stable"** es el commit que hoy está en
producción, tu punto de retorno.

| Entorno | URL | Base de datos | Stripe | Para qué |
|---|---|---|---|---|
| **Producción (stable)** | www.onyxtradinglive.com | proyecto `onyx-prod` | LIVE | Clientes reales, dinero real |
| **Beta** | beta.onyxtradinglive.com | proyecto `onyx-beta` | TEST | Probar lo nuevo, sin riesgo |
| **Local (dev)** | localhost:3000 | onyx-beta (o `onyx-dev`) | TEST | Tu máquina |

**Regla de oro:** nunca compartas una base entre producción y beta. Un fallo en beta
jamás puede tocar datos ni pagos reales.

---

## 1) Crear la base de beta (una sola vez) — snapshot + restore

**No se re-ejecutan las migraciones desde cero.** Se toma una copia del esquema de
producción (que ya está bien) y se restaura en beta. Postgres exporta en orden de
dependencias, así que no hay errores de orden. Pasos exactos en **`docs/MONTAR_BETA.md`**.

Resumen:
1. Supabase → **onyx-prod** → **Database → Backups** → **Restore to a new project**
   → nómbralo `onyx-beta`. (Alternativa: `supabase db dump` + `psql`, ver el runbook.)
2. En beta, **vacía los datos personales** (privacidad); deja catálogos/planes.
3. Crea el bucket de Storage si no se creó solo, con el mismo nombre que en prod.
4. Copia `URL`, `anon key` y `service_role key` (Settings → API) a Vercel-beta.

> `supabase/_SETUP_ALL.sql` queda solo como **referencia/histórico**, no como forma
> de montar la base. La base de producción ya existe (`onyx-prod`); no la toques aquí.

## 2) Dos despliegues en Vercel (mismo repo)

**Opción recomendada — dos proyectos Vercel del mismo GitHub:**

- **onyx-prod** → dominio `www.onyxtradinglive.com` → variables de `.env.production.example`.
- **onyx-beta** → dominio `beta.onyxtradinglive.com` → variables de `.env.beta.example`.

En cada proyecto: Settings → Environment Variables → pega las de su archivo
(reemplaza los `...` por tus claves reales). El de beta usa la base y el Stripe de beta.

> Alternativa (un solo proyecto): usa **Production** vs **Preview** de Vercel con
> variables por entorno y fija una rama `beta` para las Preview. Funciona, pero dos
> proyectos con dos URLs es más fácil de razonar y es lo que espera el switch admin.

## 3) Stripe aislado

- **Beta:** claves `sk_test` / `pk_test`. Crea un **webhook (modo test)** apuntando a
  `https://beta.onyxtradinglive.com/api/stripe/webhook` y usa su `whsec` en beta.
  Crea los precios (Pro/Elite/…) en modo test y pon esos price IDs en beta.
- **Producción:** claves `sk_live` / `pk_live`. Webhook (modo live) a la URL de prod.
  Precios en modo live. **Nunca** mezcles un `whsec` de test con claves live.

## 4) Telegram, Push y correo

- **Telegram:** crea un **segundo bot** en @BotFather para beta (`OnyxTradingBetaBot`),
  así los avisos de pruebas no salen por el bot real. Configura su webhook a la URL de beta.
- **Push (VAPID):** genera un par de claves distinto para beta.
- **Resend:** puedes compartir la API key, pero usa un remitente/asunto de pruebas.

## 5) Datos

Producción tiene usuarios reales. Beta empieza **vacía**: creas cuentas de prueba a mano.
**Nunca** copies datos personales de prod a beta sin anonimizar (privacidad). Para probar
pagos, usa las tarjetas de test de Stripe (p. ej. `4242 4242 4242 4242`).

---

## Flujo de trabajo (cada vez que sacas algo nuevo)

1. **Programa y sube** el cambio → se despliega en **beta** (rama que apunta a beta).
2. Si trae SQL nuevo, córrelo **en la base de beta** (Supabase → SQL Editor).
3. **Prueba** en beta con cuentas falsas y Stripe test.
4. Cuando está bien: **promueve el mismo commit a producción**
   (en Vercel: *Promote to Production*, o haz merge a la rama de prod).
5. Corre la **misma SQL** en la base de **producción**.
6. Ese commit promovido es tu nuevo **"stable"**. Anótalo (o etiquétalo `git tag stable-vNN`).

> Orden importante: **primero la base, luego el código**, si el código nuevo depende de
> columnas/tablas nuevas. Así producción nunca queda con código que pide algo que no existe.

---

## Rollback (si producción se rompe)

- **Código:** en Vercel, *Instant Rollback* al despliegue anterior (el "stable").
- **Base de datos:** restaura desde los backups de Supabase (PITR en plan de pago).
  Recuerda: revertir código NO revierte datos; si una migración borró/renombró algo,
  necesitas el backup.
- Por eso: antes de una migración grande en prod, haz un backup manual y guarda el
  `git tag` del stable.

---

## Checklist rápida

- [ ] Proyecto Supabase `onyx-beta` creado y `_SETUP_ALL.sql` corrido (sin errores).
- [ ] Proyecto Vercel `onyx-beta` con dominio `beta.` y variables de beta.
- [ ] Stripe **test** + webhook a beta; Stripe **live** + webhook a prod.
- [ ] Bot de Telegram de beta separado.
- [ ] `NEXT_PUBLIC_APP_ENV=beta` en beta (muestra la franja de pruebas) y `production` en prod.
- [ ] `NEXT_PUBLIC_PROD_URL` y `NEXT_PUBLIC_BETA_URL` iguales en ambos (para el switch admin).
- [ ] Probado un registro + un pago test + una sync de EA en beta antes de tocar prod.
