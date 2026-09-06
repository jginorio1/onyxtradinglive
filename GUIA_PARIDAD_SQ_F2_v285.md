# Onyx Bot Factory · Paridad con StrategyQuant — Fase 2 (v285)

Cierra la evolución genética y le suma un veredicto anti-sobreajuste que SQ no tiene.

## Evolución genética simple y transparente
En el Motor, junto a "Backtestear lote" y "🧬 Evolucionar", ahora controlas:
- **Generaciones** (3–40) — cuántas rondas de mejora.
- **Población** (20–200) — cuántas estrategias por ronda.
- **Mutación** (0.05–0.6) — cuánta variación se introduce.
- **Reinicio si estanca** (N generaciones) — si el mejor no mejora en N rondas, inyecta "sangre nueva" (individuos aleatorios) para no atascarse. 0 = apagado.

La **curva de fitness por generación** ya se muestra: sube = mejora manteniéndose fuera de muestra. Todo es determinista (misma semilla → mismo resultado) y usa tu división OOS.

**Mejor que SQ:** el fitness **penaliza la complejidad** (cada indicador/filtro/trailing de más resta) y exige que el rendimiento se **mantenga fuera de muestra**. Así la evolución no premia robots enrevesados y curve-fit.

## Onyx Robustness Score (0–100)
En la ficha de la estrategia seleccionada aparece un **anillo con nota A–F** y su desglose:
- **Consistencia IS≈OOS** (30) — que dentro y fuera de muestra se parezcan.
- **Rentable fuera de muestra** (20) — que gane en lo no visto.
- **Control de drawdown** (15).
- **Resiste Monte Carlo** (20) — al barajar las operaciones.
- **Simplicidad** (15) — menos piezas = menos sobreajuste.

Un solo número claro en vez de 20 métricas sueltas. **Mejor que SQ:** SQ te da SQN, R-expectancy, etc. por separado y sin castigar la complejidad; aquí un veredicto directo que hace justo eso.

## Instalar
No hay SQL nuevo. Sube el proyecto. Por defecto: 10 generaciones, población 60, mutación 0.25, reinicio a las 6 generaciones sin mejora.

## Con esto quedan cubiertos los dos frentes
Fase 1 = control fino de datos y trading (fechas IS/OOS, opciones de trading, OOS obligatorio). Fase 2 = evolución transparente + Onyx Robustness Score. Onyx iguala a StrategyQuant en lo esencial y lo supera donde importa: **anti-sobreajuste como compuerta, no como métrica opcional** — todo en la nube y bilingüe.
