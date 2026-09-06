# Onyx Bot Factory · Auditoría del pipeline de datos y arreglo de la ficha vacía (v291)

## El síntoma
Al guardar en la biblioteca, la fila salía rota: símbolo "—", `0y`, `0 filas`, `0% rechazada`, sin barras.

## La causa raíz (bug de código)
Había **dos** handlers `dataset_save` en `app/api/admin/factory/route.ts`:

1. Uno viejo (arriba) que leía `b.symbol`, `b.timeframe`, `b.metrics` **planos**.
2. El completo (abajo) que lee `b.meta` (símbolo, barras, fuente, rango de años, filas, calidad…).

El cliente envía TODO dentro de `meta:{…}`. Como el handler viejo estaba primero, **atrapaba la petición y respondía antes** que el completo: guardaba una ficha con símbolo/métricas vacíos y jamás corría el guardado real. Por eso la fila quedaba en blanco.

**Arreglo:** eliminé el handler viejo. Ahora solo corre el completo → se guardan símbolo, `data_kind` (ticks/barras), `from_year`/`to_year`/`years`, `rows`, `bars_url` (chip "listo p/ motor"), fuente/broker, calidad y veredicto.

## Segundo error que anticipé y corregí
En `save()`, la subida de "ticks reales" estaba atada solo a que existiera un archivo (`wantTick: !!gate.file`), no a que **fuera** ticks. Resultado: un dataset de **barras** subía su CSV otra vez como `.ticks.csv` y guardaba `tick_url` → la biblioteca le pintaba el chip **"⚡ ticks reales"** a datos que en realidad son barras (y gastaba almacenamiento duplicado).

**Arreglo:** ahora solo se sube y marca como ticks cuando `metrics.hasTicks` es verdadero. Un dataset de barras guarda solo sus barras OHLC (comprimidas), sin chip de ticks falso.

## Auditoría del flujo completo (verificado punta a punta)
- **Puerta 0 → analizar:** Web Worker lee el archivo entero con arreglos tipados; detecta símbolo, ticks vs barras, rango de fechas real y bucketea a barras M1. Sobrevive a navegar por el panel; con bitácora persistente (v286).
- **Validar:** el veredicto de calidad se calcula en el servidor (`validateMetrics`) — confiable, no manipulable desde el navegador.
- **Guardar barras:** `barsToJSON` redondea a los dígitos del símbolo (JSON 3× más ligero) → `barsToUploadBlob` lo comprime en **gzip automático** (10× menos peso) → subida **directa a Supabase Storage** con URL firmada (no pasa por Vercel, soporta varios GB).
- **Guardar ficha:** el handler completo persiste todas las columnas (requiere haber corrido `factory_v6.sql`/`factory_v7.sql`). Tolerante: si faltan columnas, reintenta con el set básico en vez de fallar.
- **Cargar en Motor/Lab:** `fetchColumnar(bars_url)` descarga y **detecta gzip por su firma** `1F 8B`; descomprime si hace falta o parsea JSON plano (compatible con datasets viejos y nuevos).
- **Motor:** filtra datasets por `verdict !== 'rechazada' && bars_url`, así nunca intenta correr sobre una ficha sin barras.

## Requisito de base de datos
Si aún no lo hiciste, corre en Supabase → SQL Editor: `supabase/factory_v6.sql` y `supabase/factory_v7.sql` (crean `bars_url`, `data_kind`, `from_year`, `tick_url`, etc.) y el `FIX_bucket_factory-data.sql` (crea el bucket). Sin esas columnas, la ficha se guarda pero le faltará el chip "listo p/ motor".

## Instalar
No hay SQL nuevo en esta entrega. Sube el proyecto (Vercel) y vuelve a guardar un dataset en la Puerta 0: la fila saldrá completa.
