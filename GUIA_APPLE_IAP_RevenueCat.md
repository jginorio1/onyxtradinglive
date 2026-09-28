# Apple In-App Purchase con RevenueCat — Guía de activación (SOLO iOS)

Esta guía resuelve el rechazo de Apple **Guideline 3.1.1 (In-App Purchase)**. En iOS los
planes se compran ahora con **Apple In-App Purchase** (Face ID / Apple Pay) a través de
**RevenueCat**. En web y Android **no cambia nada**: se sigue cobrando con Stripe.

El plan del usuario se calcula solo con una **capa de entitlements** unificada:
`profiles.plan = el de mayor rango entre stripe_plan (web/Android) e iap_plan (Apple/iOS)`.
Nunca se le baja el plan a quien ya paga por Stripe.

---

## 0) Qué ya está hecho en el código (no tienes que tocarlo)

- **SQL** `supabase/entitlements.sql` — columnas `stripe_plan`, `iap_plan`, `iap_product`,
  `iap_status`, `iap_expires_at`, `rc_user_id`, `iap_updated_at` en `profiles`.
- **lib/entitlements.ts** — plan efectivo (gana el de mayor rango).
- **app/api/revenuecat/webhook/route.ts** — recibe eventos de RevenueCat y activa/baja el plan.
- **lib/iap.ts** + **app/pricing/IosPlans.tsx** — compra nativa dentro de la app iOS.
- **package.json** — dependencia `@revenuecat/purchases-capacitor`.
- **app/globals.css / app/pricing/page.tsx** — en iOS se muestra `/pricing` con compra Apple.

Tú solo tienes que hacer la configuración de cuentas y variables de abajo.

---

## 1) App Store Connect — Acuerdos y banca (bloqueante)

1. **Agreements, Tax, and Banking** → firma el **Paid Apps Agreement**.
2. Completa **datos bancarios** y **datos fiscales** (sin esto, Apple no deja crear
   productos de pago ni pagarte).
3. **Small Business Program** (recomendado): si facturas < 1 M USD/año, inscríbete para
   pagar **15 %** de comisión en vez de 30 %. Se solicita una vez y aplica al año natural.
   https://developer.apple.com/app-store/small-business-program/

## 2) App Store Connect — Suscripciones auto-renovables

Crea un **Subscription Group** (p. ej. "Onyx Trading Live") y dentro un producto por plan.
Usa **product IDs con el id del plan dentro** (así el webhook los mapea solo):

| Plan Onyx | Precio web (ref.) | Product ID sugerido | Duración |
|-----------|-------------------|---------------------|----------|
| Pro       | $19 / mes         | `onyx_pro_month`    | 1 mes    |
| Elite     | $39 / mes         | `onyx_elite_month`  | 1 mes    |
| Black Onyx| $119 / mes        | `onyx_black_month`  | 1 mes    |

Notas:
- El **precio de App Store** puede diferir del de la web (Apple usa sus tramos de precio).
  La app **muestra el precio real de App Store** que le da RevenueCat, no un número fijo.
- Para cada producto: nombre para mostrar, descripción, y **captura de la pantalla de
  compra** (la de `/pricing` dentro de la app sirve).
- Deja los productos en estado **"Ready to Submit"**; se aprueban junto con el build.
- (Opcional) planes **anuales**: crea `onyx_pro_year`, etc., y añádelos al mapa.

## 3) RevenueCat

1. Crea un proyecto y añade la **app de iOS** (Bundle ID de tu app).
2. **App Store Connect App-Specific Shared Secret**: pégalo en RevenueCat (Apple → In-App
   Purchase Key / Shared Secret) para que valide recibos.
3. **Products**: importa/crea los product IDs del paso 2.
4. **Entitlement**: crea uno (p. ej. `pro_access`) y adjunta los 3 productos, o crea un
   entitlement por plan. El webhook no depende del nombre del entitlement (mapea por
   product_id), así que cualquiera de las dos formas vale.
5. **Offering** "default": añade un **package** por plan (Monthly) apuntando a cada producto.
   `lib/iap.ts` busca el package cuyo `product.identifier` contiene el id del plan.
6. **API Keys** → copia la **Public SDK Key (Apple)** → variable `NEXT_PUBLIC_REVENUECAT_IOS_KEY`.
7. **Webhooks** → añade uno apuntando a:
   `https://www.onyxtradinglive.com/api/revenuecat/webhook`
   y en **Authorization header** pon un secreto → variable `REVENUECAT_WEBHOOK_SECRET`
   (el webhook rechaza cualquier llamada cuyo header no coincida).

## 4) Variables de entorno (Vercel)

Añádelas en **Production** (y beta si aplica):

```
NEXT_PUBLIC_REVENUECAT_IOS_KEY=appl_XXXXXXXXXXXXXXXXXXXX
REVENUECAT_WEBHOOK_SECRET=<un secreto largo, el mismo que pusiste en RevenueCat>
REVENUECAT_PRODUCT_MAP={"onyx_pro_month":"pro","onyx_elite_month":"elite","onyx_black_month":"black"}
```

`REVENUECAT_PRODUCT_MAP` es **opcional**: si nombras los product IDs con el id del plan
dentro, el webhook los mapea por convención. El mapa solo hace falta si usas otros nombres.

## 5) Base de datos

Corre una vez en Supabase (SQL Editor):

```
-- supabase/entitlements.sql
```

Es idempotente (`add column if not exists`) y copia el `plan` actual a `stripe_plan` para
no perder los planes ya vendidos por Stripe.

## 6) Build de iOS (Codemagic) y prueba en Sandbox

1. `npm install` (baja el plugin nuevo) → `npx cap sync ios`.
2. Sube un **build nuevo** por Codemagic a **TestFlight** (el marcador de iOS
   `OnyxiOSApp` en el user-agent y el plugin de compra van dentro del binario, así que
   **hace falta build nuevo**, no basta con desplegar la web).
3. En el iPhone: **Ajustes → App Store → Sandbox Account** con un **Sandbox Tester**
   (App Store Connect → Users and Access → Sandbox).
4. Abre la app desde TestFlight → `/pricing` → **Comprar Pro** → la compra es de Sandbox
   (no cobra). Verifica en RevenueCat (Customer) y en `profiles` que `iap_plan` y `plan`
   quedan en `pro`.
5. Prueba **Restaurar compras** y una renovación de Sandbox (el reloj de Sandbox va
   acelerado).

## 7) Enviar a revisión

- En el envío del build, adjunta los **3 productos de suscripción** en "In-App Purchases".
- En **App Review Information / Notes**, indica: *"Las suscripciones se compran dentro de
  la app con Apple In-App Purchase (RevenueCat) en la pantalla de Planes"* y deja una
  **cuenta de demo** ya logueada.
- Añade en algún lugar visible los enlaces a **Términos (EULA)** y **Privacidad**
  (requisito de Apple para suscripciones).

---

## Cómo funciona (resumen técnico)

- La app iOS carga la web remota (`server.url`). Detectamos iOS por el marcador de
  user-agent **`OnyxiOSApp`** (fiable aunque el puente JS no esté listo).
- En iOS, `/pricing` renderiza `IosPlans` → `configureIAP(profiles.id)` arranca RevenueCat
  con `appUserID = id del perfil`. Así el webhook sabe a quién activarle el plan.
- Al comprar, Apple procesa el pago; RevenueCat valida el recibo y llama a nuestro webhook,
  que escribe `iap_plan` y recalcula `plan` (gana el mayor entre Stripe e IAP).
- Cancelación → sigue activo hasta expirar; expiración/reembolso → baja a Stripe o Free.
- Web y Android **no se tocan**: siguen con Stripe. El plan efectivo nunca baja por debajo
  de lo que el usuario ya paga por Stripe.
