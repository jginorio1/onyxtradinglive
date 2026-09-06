# Onyx Bot Factory · Registro de análisis y arreglo del "análisis en blanco" (v286)

## Qué pasó realmente
El análisis vive en la memoria del navegador. Dos cosas lo tumbaron a la vez:
1. Dejaste la pestaña en segundo plano ~2 h → el navegador **congela** las pestañas ocultas y el análisis se frenó (por eso quedó en 10%).
2. Al volver entraste con el PIN, que **recarga la página** → la memoria se borra (el archivo local no se puede conservar tras recargar). Por eso lo viste "en blanco".

## Qué se añadió (definitivo)
- **Registro de análisis (bitácora) persistente**: cada evento queda guardado con **hora y fecha** — inicio, 5%, 10%, "pestaña en segundo plano", "estancado", "detenido por recarga", "completado", errores. Sobrevive a recargas: aunque entres con el PIN, al volver ves el registro con lo que pasó y cuándo.
- **Telemetría en vivo**: MB leídos / total, filas, velocidad (MB/s), tiempo transcurrido y **ETA** estimado.
- **Detección de estancamiento**: si no avanza en 25 s, sale un aviso ("¿dejaste la pestaña en segundo plano? Vuelve a esta pestaña"). También registra cuándo la pestaña pasó a segundo plano y volvió.
- **Aviso de interrupción**: si el análisis se cortó por una recarga, al volver aparece un banner ámbar explicando qué pasó, en qué % iba, y con el registro debajo. Botón **Descargar** el registro (.txt) para tener contexto.
- **Latido (heartbeat)**: el worker reporta cada 2 s aunque no cambie el %, así se sabe si sigue vivo o se congeló.

## Cómo evitar que se te vuelva a "reiniciar"
1. **Mantén esta pestaña en primer plano** mientras analiza archivos grandes (varios GB). No la dejes oculta horas.
2. **No recargues ni entres con el PIN** hasta que el análisis termine — la recarga borra la memoria.
3. Si el archivo es enorme, déjalo corriendo en primer plano; el ETA te dice cuánto falta.

## Instalar
No hay SQL nuevo. Sube el proyecto. El registro se guarda en el navegador (localStorage) y no ocupa espacio en Supabase.
