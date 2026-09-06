# Onyx Bot Factory · Nivel superior (v279) — todo menos martingala

Cierra el resto de la brecha con StrategyQuant/EA Studio. Se añadió **todo lo del análisis de brechas EXCEPTO martingala**, tal como pediste.

## 1) Gestión monetaria extra (sin martingala)
En el Motor → **Gestión monetaria y dirección**:

- **% con stop por volatilidad (ATR)** — nuevo modelo `risk_atr`. El stop se deriva de la volatilidad real (ATR × factor que tú eliges, por defecto 1.5) y el lote se dimensiona para arriesgar tu % del equity sobre ese stop. En mercados calmados arriesga más distancia con menos lote; en mercados agitados, al revés. Es sizing adaptado a la volatilidad.
- **Anti-martingala** ya está integrado en el % sobre equity: al componer sobre el equity vivo, el lote **sube cuando ganas y baja cuando pierdes** (lo contrario a martingala). No hay ni habrá martingala.
- **Pirámide (añadidos)** — nuevo campo. Con valor 1–5, si la posición sigue abierta, hay señal a favor y el precio avanzó ≥ 0.5·ATR desde el último añadido, el motor **suma una pata a favor** (hasta el máximo que fijes). Deja 0 para desactivar.

## 2) Reto prop firm completo (con veredicto)
Nuevo panel **🏁 Reto prop firm (opcional)** en el Motor:

- **Objetivo de beneficio %** · **Pérdida diaria máx %** · **Días mínimos**. Deja en 0 lo que no apliques.
- Cada backtest devuelve un **veredicto**: “✓ PASA EL RETO / ✗ NO PASA”, con beneficio logrado, días operados y aviso si rompió la pérdida diaria.
- En la **Receta**, si el reto está activo, los robots que **no pasan** se descartan automáticamente (igual que los que revientan la cuenta). Así solo salen robots aptos para el reto.

Mejor que SQ: en StrategyQuant las reglas de prop firm son un chequeo posterior; aquí son **una compuerta de la generación**.

## 3) Optimizador con búsqueda de meseta
En **Estrategia seleccionada → 🔎 Optimizador**:

- Barre rangos de **período / TP / SL** y puntúa cada combinación (PF, consistencia, penaliza drawdown).
- En vez del **pico** (que casi siempre está sobre-ajustado), recomienda la **MESETA**: la zona donde los parámetros vecinos también rinden. Muestra un mapa de calor, la **estabilidad de la meseta** (%) y el pico bruto marcado en ámbar como advertencia.
- Botón **“Usar la meseta”** aplica esos parámetros a la estrategia seleccionada.

Por qué importa: un robot en meseta sobrevive fuera de muestra; un robot en el pico suele morir en real.

## 4) Portafolio multi-símbolo / multi-timeframe con correlación
Nuevo panel **Portafolio multi-símbolo** (aparece si tienes ≥ 2 datasets con barras guardadas):

- Elige la estrategia seleccionada y **varios datasets** (par + temporalidad) de tu biblioteca.
- Corre el backtest en cada uno, combina las curvas y calcula: **neto combinado, PF combinado, drawdown combinado, correlación media y diversificación**.
- **Matriz de correlación mensual** entre robots: verde/azul = baja o negativa correlación (buena diversificación), rojo = se mueven juntos.

Una cartera de robots poco correlacionados baja el drawdown combinado; eso es lo que buscan las prop firms y los fondos.

## Instalar
No hay SQL nuevo. Sube el proyecto. Valores por defecto seguros: balance 10.000, 1 % de riesgo sobre equity, drawdown trailing 10 %, pirámide 0, reto en 0 (desactivado).

## Nota
Todo esto sigue siendo **simulación histórica**: no predice el mercado. Úsalo para descartar lo frágil, no para prometer resultados.
