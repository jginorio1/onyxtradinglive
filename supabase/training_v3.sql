-- =====================================================================
-- Onyx Training · v3 — material adjunto (PDF/archivo) por lección.
-- Corre DESPUÉS de training_v1/v2. Idempotente.
-- =====================================================================
alter table training_lessons add column if not exists doc_url  text;  -- URL del PDF/archivo
alter table training_lessons add column if not exists doc_name text;  -- nombre para el botón de descarga
