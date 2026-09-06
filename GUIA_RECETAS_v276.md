# Onyx Bot Factory · Tanda 3/3 — Recetas + 8 Monte Carlo + Walk-Forward Matrix (v276)

Con esto la fábrica iguala (y supera) el flujo de robustez de StrategyQuant.

## Qué trae

**Receta encadenada** (en el Motor):
Un botón corre todo el embudo con compuertas configurables:
`Generar → Backtest → In/Out-of-sample → Monte Carlo (8 tipos) → Walk-forward matrix → sobreviven`.
Ajustas los umbrales (PF mínimo, DD máx, ops mín, prob. de pérdida MC máx, estabilidad WF mín) y solo pasan los que superan **todas** las compuertas. Ves el embudo con el conteo en cada etapa y puedes **enviar los supervivientes al laboratorio** de un clic.

**8 tipos de Monte Carlo** (antes 1): orden de operaciones, remuestreo bootstrap, saltar operaciones, redimensionar posición, slippage extra, menos operaciones, inicio aleatorio y peores primero. Para cada uno se mide la **probabilidad de acabar en pérdida** y el **drawdown del peor 5%**.

**Walk-forward matrix** (nuevo): prueba varias variaciones del parámetro principal en varios tramos out-of-sample y muestra un **mapa de calor** (PF por celda). Verde en muchas celdas = **meseta robusta**, no un pico afortunado. Da una **estabilidad %** que sirve de compuerta.

Todo corre en el navegador (sin coste de servidor) usando el motor de backtest y los ticks/barras que ya tienes.

## Instalar
No hay SQL nuevo. Solo sube el proyecto. (Si venías de antes: `factory_v6/v7/v8/v9.sql` ya cubren datos, ticks, plantillas y bloques.)

## Con esto queda cerrado el "paquete completo" estilo StrategyQuant:
1. ✅ Biblioteca de plantillas + Claude (Tanda 1)
2. ✅ Bloques ampliados + generador de bloques con Claude (Tanda 2)
3. ✅ Recetas encadenadas + 8 Monte Carlo + walk-forward matrix (Tanda 3)

Más lo que StrategyQuant NO tiene: ticks reales en la nube, 6 meses en demo real y 1-clic a real.
