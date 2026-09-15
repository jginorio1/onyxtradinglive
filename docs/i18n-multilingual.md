# Onyx — Multilingüe (ES · EN · ZH · JA · PT · VI)

Cómo funciona el sistema de idiomas en toda la app y cómo completar la traducción al 100 %.

## Arquitectura

- **UI (cliente)**: todo el texto pasa por `L('español','english')`, que enruta por
  `lib/i18n.ts → translate(lang, es, en)`. La clave es el **texto en español**. Si el
  idioma es zh/ja/pt/vi, busca en `lib/i18n/{zh,ja,pt,vi}.ts`; si falta la entrada,
  cae a **inglés** (nunca español). Los diccionarios por-idioma (`NAV_T`, etc.) usan
  `X[lang] || X.en`.
- **IA (coach, soporte, academia, embajadores, equipo)**: responde en el idioma del
  usuario. `lib/i18n.ts → aiLangDirective(lang)` añade al prompt "escribe TODO en
  {idioma}". Las rutas de IA pasan el idioma real con `pickLang()` / `langFromCookie()`.
- **Telegram, email, notificaciones, reportes, campañas**: para zh/ja/pt/vi usan
  **inglés** como respaldo (regla: `=== 'es' ? 'es' : 'en'`). Se localizan del todo
  a medida que se llenan los diccionarios / se crean plantillas por idioma.
- **EA / cBots (MetaTrader / cTrader)**: el selector de idioma incluye los 6. En el
  gráfico solo se garantiza Español/Inglés (MT no renderiza chino/japonés sin fuente
  CJK); otros idiomas muestran el panel en Inglés. El dashboard web, la IA y Telegram
  llevan la localización real.

## Completar la traducción de UI al 100 %

Dos scripts:

```bash
# 1) Extrae todas las cadenas L('es','en') únicas → scripts/i18n-strings.json
node scripts/i18n-extract.mjs

# 2) (Opcional) Semilla curada a mano de los ~120 textos más visibles
node scripts/i18n-core-seed.mjs

# 3) Onyx AI traduce TODO lo que falte a zh/ja/pt/vi (idempotente)
ANTHROPIC_API_KEY=sk-... node scripts/i18n-translate.mjs
#   ONLY=pt,vi   solo esos idiomas
#   FORCE=1      retraduce todo
```

El paso 3 escribe/rellena `lib/i18n/{zh,ja,pt,vi}.ts` sin pisar lo ya traducido, y
guarda tras cada lote (resistente a cortes). Revisa el diff y haz commit.

## Añadir otro idioma en el futuro

1. `lib/navText.ts`: añade el código a `Lang`, `LANGS`, `LANG_META`, y una columna a `NAV_T`.
2. `lib/i18n.ts`: importa `lib/i18n/<xx>.ts`, añádelo a `MEM` y a `LANG_NAME`.
3. `middleware.ts`: añade el código a `PREFIXES`.
4. `node scripts/i18n-translate.mjs` con `ONLY=<xx>`.

## Estado

- ✅ Infraestructura de 6 idiomas, selector, URLs con prefijo, hreflang, fuentes CJK.
- ✅ IA responde en el idioma del usuario en todas sus superficies.
- ✅ Servidor (Telegram/email/reportes/campañas): respaldo en inglés para los 4 nuevos.
- ✅ EA/cBots: selector de 6 idiomas (panel en ES/EN por límite de fuentes en MT).
- ✅ Núcleo de UI (~120 textos) traducido a mano en los 4 idiomas.
- ⏳ Cola larga de UI (~900 textos): correr `i18n-translate.mjs` para llenarla.
