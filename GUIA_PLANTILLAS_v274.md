# Onyx Bot Factory · Biblioteca de plantillas (v274) — Tanda 1/3

Estilo StrategyQuant, mejorado con Claude AI.

## Qué trae
- **Biblioteca de plantillas** en el Constructor: presets con **nombre · instrumento · temporalidad · bloques · rangos**.
- **4 plantillas de fábrica** listas: Oro Ruptura Londres (XAUUSD M15), EURUSD Reversión NY (M5), US30 Tendencia (H1), GBPJPY Volatilidad (M30).
- Botón **"Usar"** en cada plantilla → carga sus bloques en el generador con el instrumento y la temporalidad ya puestos.
- **"✨ Claude, arma una"**: eliges instrumento, temporalidad, familia y (opcional) un dataset; Claude diseña la plantilla mirando las características de tus datos y explica por qué. La guardas con un clic.
- Desde el generador: **"💾 Guardar como plantilla"** guarda tu selección actual de bloques como plantilla reutilizable.
- Borrar tus plantillas (las de fábrica no se borran).

## Ventaja sobre StrategyQuant
StrategyQuant rellena placeholders al azar. Aquí **Claude diseña la plantilla** según el símbolo, la volatilidad, el spread y las sesiones de tus datos — no al azar. Si no hay `ANTHROPIC_API_KEY`, usa una plantilla base por familia (y te avisa).

## Instalar
1. Corre **`supabase/factory_v8.sql`** (crea `factory_templates`).
2. (Opcional pero recomendado) Pon `ANTHROPIC_API_KEY` en las variables de entorno para que Claude arme/tunee plantillas. Sin ella, funciona con plantillas base.
3. Sube el proyecto.

## Próximas tandas (2/3 y 3/3)
- **Tanda 2:** ampliar la librería de bloques + generador de bloques nuevos con Claude.
- **Tanda 3:** recetas encadenadas (build→retest→optimizar→Monte Carlo→rechazar), los 8 tipos de Monte Carlo y walk-forward matrix.
