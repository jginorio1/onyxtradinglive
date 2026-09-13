-- ============================================================
-- Onyx Academy · v18 — Control del mentor sobre alumnos + descarga de PDF.
-- Idempotente. Correr DESPUÉS de academy_v17.sql.
-- ============================================================

-- Nombre visible del alumno DENTRO de la academia (alias que el mentor puede
-- corregir; NO toca el perfil global del usuario). Null = usa su nombre real.
alter table academy_enrollments add column if not exists display_name text;

-- El estado de la inscripción ya admite 'banned' (además de 'active').
-- No requiere columna nueva; el mentor lo cambia desde su panel.

-- ¿El alumno puede descargar el PDF de la lección? true por defecto.
alter table academy_lessons add column if not exists pdf_download boolean not null default true;

notify pgrst, 'reload schema';
