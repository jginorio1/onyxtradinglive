# Onyx Bot Factory · Gestión monetaria + dirección (v278)

Cierra la brecha con StrategyQuant/EA Studio en money management, y la supera atándolo a la robustez.

## Qué se añadió (en el Motor)
- **Dirección**: Ambos (Long+Short) · Solo Long · Solo Short. También en el popup del generador.
- **Balance inicial ($)** de la cuenta para la simulación.
- **Tamaño de posición (money management):**
  - **% de riesgo sobre equity** (compuesto) — el lote se recalcula en cada operación según el equity y la distancia al stop.
  - **Riesgo fijo ($)** por operación.
  - **Lote fijo**.
- **Límite de drawdown**, como una prop firm:
  - **Trailing** (desde el pico de equity)
  - **Estático** (desde el balance inicial)
  - con **DD máx %**. Si la cuenta toca el límite, "revienta" y ese robot **se descarta** automáticamente en la Receta y el Autopiloto.

## Por qué es mejor que StrategyQuant
En SQ el money management y las reglas de prop firm son módulos aparte que no filtran la generación. Aquí el **drawdown límite es una compuerta de la fábrica**: un robot que reventaría una cuenta fondeada nunca pasa. Además el % de riesgo compone sobre equity dentro del mismo backtest tick-a-tick.

## Instalar
No hay SQL nuevo. Sube el proyecto. Los valores por defecto: balance 10.000, 1% de riesgo sobre equity, drawdown trailing 10%.

## Análisis de brechas (siguiente nivel, opcional)
Lo que aún podríamos añadir para dejarlo por encima de todos:
- **Optimización de parámetros** in-app (además de la walk-forward matrix): rangos de período/TP/SL con búsqueda de meseta.
- **Portafolio multi-símbolo/multi-timeframe** con correlación (ya hay correlación entre robots; falta generar cruzando varios datasets).
- **Modelos de money management extra**: martingala/anti-martingala, pirámide, riesgo por volatilidad (ATR).
- **Reglas prop firm completas**: objetivo de beneficio + límite diario + días mínimos, con veredicto "pasa el reto".
