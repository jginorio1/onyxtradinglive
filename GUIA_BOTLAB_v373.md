# Onyx v373 · La comisión editable ahora también actualiza la Guía

Antes: al cambiar la comisión de Onyx (`fee_pct`) en Admin → Bot Lab → Ajustes, el
**landing** y el **FAQ** ya se ajustaban solos, pero la **Guía** (centro de ayuda) tenía el
80/20 escrito a mano y no cambiaba.

Ahora los tres coinciden siempre con lo que cobras de verdad:

- **Landing** (`/bot-lab`): usa `keepPct = 100 − fee_pct` en vivo. ✔ (ya estaba)
- **FAQ** (`/bot-lab/faq`): reemplaza 80%→te quedas y 20%→Onyx con el valor real. ✔ (ya estaba)
- **Guía** (`/guia`, artículos de Onyx Bot Lab): ahora `/api/guide` reemplaza en vivo el 80/20
  **solo** en la categoría `botlab`, con el `fee_pct` actual. ✔ (nuevo en v373)

## Cómo funciona

En `app/api/guide/route.ts`, al servir los artículos se aplica `applyBotlabFee`: lee
`botLabSettings().fee_pct` y, si es distinto de 20, reescribe "80%"→(100−fee) y "20%"→fee
en el cuerpo de los artículos de la categoría Bot Lab. No toca otras categorías (por ejemplo,
un artículo de psicología que menciona "80% de aciertos" queda intacto).

Nada de SQL nuevo. Cambias el % en Admin y la guía queda al día en el siguiente refresco.
