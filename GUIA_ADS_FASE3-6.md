# Onyx Ads · Fases 3–6 (nivel profesional)

Sistema de monetización de anuncios llevado de "banners sueltos" a una unidad de
ingresos real: control de artes con aprobación, formatos IAB, geo por tier,
modelos CPM/CPC/CPA, antifraude, relleno programático y directorio de partners.

## 1) Base de datos (Supabase → SQL Editor)

Corre en orden, una sola vez cada uno (todos son idempotentes):

1. `supabase/ads.sql`      (Fase 1 — si aún no)
2. `supabase/ads_v2.sql`   (Fase 2 — si aún no)
3. `supabase/ads_v3.sql`   (Fases 3–6 — nuevo)

`ads_v3.sql` añade: control de artes (creative_path, revisión, categoría,
disclaimer), geo por tier, modelos de cobro + pacing, tablas `ad_advertisers`,
`ad_wallet_txns`, `ad_stats_daily`, `ad_impression_log`, `ad_partners`, y las
funciones `ad_partner_bump` y `ad_stat_bump`.

El bucket de storage `ad-creatives` se crea solo la primera vez que un anunciante
sube un arte (público).

## 2) Despliega

`git add -A && git commit -m "Onyx Ads F3–F6" && git push` (o tu flujo normal) y
deja que Vercel construya. No hace falta ninguna variable de entorno nueva; usa
el mismo Stripe que ya tienes (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_APP_URL`).

## 3) Qué cambió, fase por fase

### F3 · Control de artes + formatos IAB (el arreglo crítico)
- El anunciante **sube el arte a NUESTRO storage** (no una URL externa que pueda
  cambiar después). Se valida tamaño exacto del slot (±2%) y peso máximo IAB.
- Tras pagar, la campaña queda **`pending` (en revisión)**, NO live. Tú la
  apruebas o rechazas en Admin → Publicidad → "Revisión de artes". Rechazar deja
  la campaña en `rejected` (reembolsa manualmente desde Stripe si aplica).
- Interruptor "Auto-aprobar" (OFF por defecto, NO recomendado) por si algún día
  quieres saltarte la revisión.
- Aviso de riesgo financiero automático en anuncios de broker/prop firm (editable).

### F4 · Inventario nuevo + geo por tier
- Nuevos espacios: `landing_billboard` (970×250), `footer_site`, `sticky_bottom`
  (barra inferior site-wide, mayor CTR), `article_halfpage` (300×600),
  `blog_native`, `directory_partner`.
- La barra sticky inferior aparece sola en páginas públicas (se cierra por sesión,
  oculta en la app nativa y a usuarios de pago).
- Geo por **Tier 1/2/3** + exclusiones de países por compliance, además de país
  específico. Tier-1 = US/UK/CA/AU/DE… (paga más).

### F5 · Modelos CPM/CPC/CPA + antifraude + reportes
- Cada campaña puede cobrarse por **plano, CPM, CPC o CPA** con presupuesto total
  y tope diario (pacing: cuando se agota, deja de mostrarse).
- **Antifraude**: una impresión por visitante/campaña/día (hash IP+UA sin PII) y
  filtro de bots. Viewability IAB (50%/1s) vía IntersectionObserver.
- Postback CPA: el anunciante llama `GET /api/ads/convert?token=SU_TOKEN` desde su
  servidor cuando ocurre un registro/fondeo.
- El reporte del anunciante (`/publicidad/reporte/[token]`) ahora incluye
  conversiones, gasto y **desglose diario** descargable en CSV.

### F6 · Programmatic fallback + directorio de partners
- **Relleno programático**: cuando ningún anunciante compró el hueco, se muestra
  el código de tu red externa (AdSense/Ezoic…). Se pega en Admin → Ajustes de
  monetización. Cero impresión perdida.
- **Directorio de partners (CPA)** en `/socios`: brokers y prop firms que pagan
  por registro — el ángulo que más rinde en este nicho. Se administra en Admin →
  "Directorio de socios". Los clics salen por `/api/ads/partner?id=…` (se cuentan)
  con `rel="sponsored nofollow"`. Postback de signup: `POST /api/ads/partner {id}`.

## 4) Páginas y rutas

Públicas:
- `/publicidad` — vender espacios (autoservicio con subida de arte + tarjeta).
- `/publicidad/gracias` — confirma el pago y avisa "en revisión".
- `/publicidad/reporte/[token]` — reporte del anunciante (impresiones, clics,
  conversiones, CTR, desglose diario, CSV).
- `/socios` — directorio de partners CPA.

Admin: **Publicidad** (área "planes"/monetización) — revisión de artes, ajustes
pro, tarifario, campañas y directorio de socios.

APIs nuevas: `/api/ads/upload`, `/api/ads/view`, `/api/ads/convert`,
`/api/ads/partner`. Ampliadas: `/api/ads/serve`, `/api/ads/click`,
`/api/ads/checkout`, `/api/ads/confirm`, `/api/ads/report`, `/api/admin/ads`.

## 5) Notas de compliance / SEO
- Todos los enlaces pagados llevan `rel="sponsored nofollow"` y etiqueta "Publicidad".
- Anuncios **solo en web** (nativo apagado hasta aprobación de Apple/Google).
- Aviso de riesgo en anuncios financieros. Vetar en revisión: retornos
  garantizados, señales-scam, brokers sin licencia en el geo objetivo.
- El reporte del anunciante lleva `robots: noindex`.
