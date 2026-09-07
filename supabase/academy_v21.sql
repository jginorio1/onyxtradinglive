-- ============================================================
-- Onyx Academy · v21 · Foto de perfil (avatar) del alumno
-- El alumno puede subir su propia foto de perfil para la comunidad.
-- El nombre visible en la academia sigue guardándose en academy_enrollments.display_name
-- (el alumno lo edita para su propia inscripción; el mentor puede sobrescribirlo).
-- Idempotente.
-- ============================================================
alter table public.profiles add column if not exists avatar_url text;

-- Marca de "editado" para posts y comentarios (el alumno puede editar lo suyo).
alter table public.academy_posts    add column if not exists edited_at timestamptz;
alter table public.academy_comments add column if not exists edited_at timestamptz;
