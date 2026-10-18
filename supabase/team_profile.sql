-- ============================================================
-- Perfil de equipo: puesto e idiomas de cada empleado.
-- (El país ya existe en profiles.country; el idioma de UI en profiles.lang.)
-- Idempotente.
-- ============================================================
alter table if exists profiles add column if not exists job_title text;   -- puesto (p. ej. "Soporte N2", "Ventas")
alter table if exists profiles add column if not exists languages text;   -- idiomas que habla, lista separada por comas ("es, en, pt")
