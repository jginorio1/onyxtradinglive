# Onyx Trading Live — App completa (Next.js)

Journal de trading que conecta cuentas MT4/MT5, con suscripciones Stripe y panel de admin. Todo listo para desplegar; solo tienes que crear las cuentas (gratis) y pegar tus claves.

## Qué incluye

```
onyx-backend/
├── app/
│   ├── page.tsx                     landing pública
│   ├── login/page.tsx               registro / login
│   ├── pricing/page.tsx             planes + checkout Stripe
│   ├── dashboard/page.tsx           journal: estadísticas, equity, operaciones
│   ├── dashboard/keys/page.tsx      generar / revocar API keys
│   ├── admin/page.tsx               panel de administrador (solo para ti)
│   ├── auth/signout/route.ts        cerrar sesión
│   └── api/
│       ├── v1/sync/route.ts         ← recibe a los conectores MT4/MT5
│       ├── keys/route.ts            crear/revocar API keys
│       └── stripe/
│           ├── checkout/route.ts    iniciar suscripción
│           ├── webhook/route.ts     eventos de Stripe (actualiza el plan)
│           └── portal/route.ts      portal de cliente (gestionar/cancelar)
├── lib/                             clientes Supabase, Stripe, estadísticas
├── supabase/schema.sql              base de datos completa
├── middleware.ts                    sesión
└── .env.example                     claves
```

## Puesta en marcha (30-40 min)

### 1. Supabase (base de datos + login) — gratis
1. [supabase.com](https://supabase.com) → New project.
2. **SQL Editor** → pega `supabase/schema.sql` → Run.
3. **Project Settings → API**: copia `URL`, `anon key` y `service_role key`.
4. **Authentication → Providers → Email**: déjalo activado. (Opcional: desactiva "Confirm email" para probar más rápido.)

### 2. Stripe (cobros) — gratis
1. [stripe.com](https://stripe.com) → crea cuenta (modo test para empezar).
2. **Products** → crea 2 productos: "Pro" ($19/mes) y "Elite" ($39/mes). Copia el **Price ID** de cada uno (`price_...`).
3. **Developers → API keys**: copia `Publishable` y `Secret`.
4. El **webhook** se configura después de desplegar (paso 4).

### 3. Configura y prueba en local
1. Renombra `.env.example` → `.env.local` y rellena todo (Supabase, Stripe, precios, `ADMIN_EMAILS` con tu email).
2. ```bash
   npm install
   npm run dev
   ```
3. Abre `http://localhost:3000` → regístrate → entra al dashboard.

### 4. Desplegar (Vercel) — gratis
1. Sube el proyecto a GitHub.
2. [vercel.com](https://vercel.com) → Import → pega **todas** las variables de entorno → Deploy.
3. Tu URL: `https://onyx-xxx.vercel.app`. Actualiza `NEXT_PUBLIC_APP_URL` con ella.
4. **Webhook de Stripe:** Developers → Webhooks → Add endpoint → `https://TU-URL/api/stripe/webhook` → eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copia el `whsec_...` a `STRIPE_WEBHOOK_SECRET` y redepliega.

## Conectar una cuenta MT4/MT5

1. En la app → **Conectar cuenta** → genera una API key.
2. En el **Onyx Connector** (MT4/MT5): pon `InpApiUrl = https://TU-URL/api/v1/sync` y `InpApiKey`.
3. Permite WebRequest a tu dominio en MT4/MT5. En segundos las operaciones aparecen en el dashboard.

## Panel de administrador

Entra en `https://TU-URL/admin` con un email que esté en `ADMIN_EMAILS`. Verás usuarios, suscriptores de pago, cuentas y operaciones totales.

## Nota

Es un MVP sólido y funcional. Para producción conviene añadir después: confirmación de email, límites por plan (nº de cuentas), notas por operación, filtros por par/sesión, e informes. Se construyen sobre esta base.
