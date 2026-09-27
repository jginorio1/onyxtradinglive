-- ============================================================
-- Onyx Academy · v13 — Asistente AI del alumno (base de conocimiento del mentor)
-- + resumen semanal AI (no requiere columnas, se calcula al vuelo).
-- Idempotente. Correr DESPUÉS de academy_v12.sql.
-- ============================================================

-- El mentor pega su guía / preguntas frecuentes. El asistente AI responde a los
-- alumnos USANDO SOLO este texto (no inventa). Vacío = asistente desactivado.
alter table mentors add column if not exists assistant_kb text;
-- Interruptor para mostrar el asistente a los alumnos.
alter table mentors add column if not exists assistant_on boolean not null default false;
