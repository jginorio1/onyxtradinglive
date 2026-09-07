-- ============================================================
-- Onyx · Diario v4: segunda captura (entrada / salida)
-- Ejecuta en Supabase → SQL Editor. Seguro de re-ejecutar.
--
-- La foto principal (image_url) pasa a ser la de ENTRADA; esta nueva columna
-- guarda la de SALIDA, para documentar el gráfico al abrir y al cerrar.
-- ============================================================

alter table trade_journal add column if not exists image_url_exit text;   -- captura de salida (opcional)
