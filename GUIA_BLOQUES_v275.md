# Onyx Bot Factory · Tanda 2/3 — Librería de bloques ampliada + bloques de Claude (v275)

## Qué trae

**Librería de bloques mucho más grande** (con soporte REAL en el motor de backtest):
- **Indicadores nuevos:** WMA, Hull MA, DEMA, TEMA, MFI, ROC, Keltner, Donchian, Envelopes, SuperTrend, Aroon, DMI, OBV, CMF (además de los que ya había).
- **Reglas de entrada nuevas:** tendencia fuerte ↑/↓, máximo/mínimo más alto, pendiente de MA, cruce del 50, reversión extrema, ruptura de compresión (squeeze).
- **Filtro nuevo (bloque):** solo con la tendencia (EMA200), solo alta o baja volatilidad.
- **Más rangos** de TP (hasta 200 / 3×ATR), SL, break-even y trailing.

Todo esto **multiplica el espacio de estrategias** y funciona ya en la generación y el backtest.

**Generador de bloques con Claude (✨):**
- En el generador de estrategias, botón **"✨ Crear bloque"**: describes la idea (p.ej. *"largo cuando RSI cruza 40 al alza y ADX sube"*) y Claude propone **reglas de entrada nuevas** como condiciones sobre indicadores.
- Se validan y se guardan; aparecen como **chips seleccionables** en el generador y **el motor las ejecuta** en el backtest.
- Sin `ANTHROPIC_API_KEY` funciona todo lo demás; el generador de bloques necesita la clave.

**Colores frescos:** el Constructor y el popup del generador ahora usan una paleta **teal/aqua/coral** totalmente distinta a Onyx (sin púrpura ni verde apagado). Barras de progreso verde lima.

## Instalar
1. Corre **`supabase/factory_v9.sql`** (crea `factory_blocks`).
2. (Si aún no lo hiciste) corre también `factory_v8.sql` (plantillas).
3. `ANTHROPIC_API_KEY` en el entorno para el generador de bloques.
4. Sube el proyecto.

## Próxima tanda (3/3)
Recetas encadenadas (build → retest → optimizar → Monte Carlo → rechazar), los **8 tipos de Monte Carlo** y **walk-forward matrix**.
