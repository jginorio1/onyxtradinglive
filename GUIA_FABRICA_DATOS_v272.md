# Onyx Bot Factory · Biblioteca de datos (v272)

## Qué cambió

**Puerta 0 · Datos**
- Ya **no pide el símbolo**: se autodetecta del archivo (nombre + contenido) y solo se muestra para confirmar.
- Nuevo campo **fuente**: Dukascopy / MetaTrader (+ broker) / Otro.
- Detecta solo el **tipo** (ticks reales vs barras) y el **rango de años** (desde → hasta).
- El análisis corre en un **Web Worker**: lee el archivo COMPLETO en segundo plano, no congela la app y **sobrevive al cambiar de pestaña**. Barra de progreso **verde lima** con brillo.
- **Fix rango de años**: antes leía solo una muestra y mostraba mal los años (p.ej. "0.5 años" cuando había 5). Ahora lee el archivo entero, así que el rango es real.
- **Fix re-subir**: tras rechazar una data ya puedes analizar otra sin refrescar ("↻ Analizar otra data").
- Al **guardar**, el dataset se sube a la **biblioteca** (Supabase Storage): las barras OHLC quedan guardadas para siempre.

**Biblioteca reutilizable**
- El **Constructor**, el **Motor** y el **Laboratorio** reutilizan los datos guardados sin volver a subir nada.
- **Motor**: selector "Desde la biblioteca" → carga las barras guardadas (sin resubir el archivo).
- **Builder**: se quitó "Strategy notes" (no se usaba).
- **Laboratorio**: aclara que **no hace falta CSV** — los robots del Motor/Autopiloto llegan ya analizados; el CSV es opcional (avanzado) para re-analizar con operaciones reales de MetaTrader.

**Pipeline**
- Más intuitivo: guía "cómo funciona en 3 pasos" + leyenda del semáforo (verde/amarillo/naranja).

## Pasos para instalar

1. En Supabase → SQL Editor, corre **`supabase/factory_v6.sql`** (añade columnas a `factory_datasets`, crea el bucket `factory-data` y recarga el caché de esquema).
2. Sube el proyecto (Vercel se despliega solo). Si el navegador cachea, haz un refresco fuerte.
3. Listo. Sube una data en la Puerta 0 → se guarda → reutilízala en Motor/Lab.

> Nota: la biblioteca guarda las **barras OHLC comprimidas** (no los 3 GB de ticks crudos), así que ocupa poco y carga rápido en el Motor.
