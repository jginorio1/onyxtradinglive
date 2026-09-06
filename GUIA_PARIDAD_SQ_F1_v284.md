# Onyx Bot Factory · Paridad con StrategyQuant — Fase 1 (v284)

Cierra los huecos de "control fino de datos y trading" que tenía SQ, más simple y más robusto.

## Opciones de trading (nuevo panel ⏱️ en el Motor)
- **Máx operaciones/día** — evita sobre-operar (0 = sin límite).
- **Hora desde / hasta (UTC)** — limita las entradas a una franja horaria; ideal para operar solo la sesión buena. −1 en ambas = todo el día.
- **Cerrar el viernes** — casilla + hora UTC; cierra todo el viernes para no cargar riesgo de fin de semana.
- **SL mín · máx / TP mín · máx (pips)** — acota stops y objetivos; descarta valores absurdos. 0 = sin límite.

Todo se aplica dentro del backtest y cada campo tiene su ⓘ con explicación.

## Dentro/Fuera de muestra (nuevo panel 🧪)
- Deslizador **OOS %** (0–50) + **presets** 20/30/50 y "Sin OOS", igual que los "most used configs" de SQ.
- Muestra las **fechas exactas** de cada tramo (dentro de muestra → fuera de muestra) calculadas de tus datos.
- El mismo % pinta la franja coral en la curva de equity del Reporte y las tarjetas IS vs OOS.

## Por qué es mejor que StrategyQuant
En SQ el filtro fuera de muestra es **opcional** y fácil de saltar. Aquí, con OOS activo, **es obligatorio en la Receta y el Autopiloto**: un robot que no **gana** en el tramo fuera de muestra (net > 0, PF ≥ 1) se descarta. Así no cuela un robot sobre-ajustado al pasado.

## Instalar
No hay SQL nuevo. Sube el proyecto. Valores por defecto: sin límites de trading (0 / −1), OOS 30%.

## Sigue en la Fase 2
Evolución genética simple y transparente (generaciones, mutación, reinicio por estancamiento con curva de fitness) + **Onyx Robustness Score** anti-sobreajuste que penaliza la complejidad y exige que el rendimiento dentro y fuera de muestra se parezcan.
