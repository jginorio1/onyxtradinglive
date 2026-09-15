-- ============================================================
-- CARRERAS v3 · Match de CV contra la vacante (IA).
-- Guarda el puntaje y el resumen del análisis por postulación.
-- Ejecutar DESPUÉS de careers_v1.sql y careers_v2.sql.
-- ============================================================

alter table job_applications add column if not exists match_score int;
alter table job_applications add column if not exists match_summary text;
alter table job_applications add column if not exists match_at timestamptz;
