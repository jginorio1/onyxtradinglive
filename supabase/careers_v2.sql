-- ============================================================
-- Onyx Trading Live · CARRERAS v2 — Bilingüe (ES/EN) con IA
--   Cada plaza guarda su versión en inglés. La IA traduce en ambos sentidos.
-- Ejecuta después de careers_v1.sql.
-- ============================================================

alter table job_openings add column if not exists title_en       text;
alter table job_openings add column if not exists summary_en     text;
alter table job_openings add column if not exists description_en text;
alter table job_openings add column if not exists tags_en        jsonb default '[]'::jsonb;

notify pgrst, 'reload schema';
