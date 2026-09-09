-- ============================================================
-- Onyx Academy · v20 · Moderación de la comunidad
-- Filtro de contenido (palabras + spam + IA), cola de revisión, reportes de la
-- comunidad y sanciones progresivas (aviso / silencio / ban). El mentor decide
-- cuán estricto quiere ser; por defecto se crea en nivel "normal".
-- Idempotente: se puede correr varias veces sin romper nada.
-- ============================================================

-- Ajustes de moderación del mentor (JSON). Vacío = usa el default "normal" del código.
alter table public.mentors add column if not exists moderation jsonb not null default '{}'::jsonb;

-- Estado de moderación de posts y comentarios.
--   visible  → publicado y a la vista de todos
--   pending  → esperando aprobación (lo marcó el filtro o es un nuevo miembro)
--   hidden   → ocultado por el equipo (o auto-ocultado por reportes)
alter table public.academy_posts    add column if not exists status      text not null default 'visible';
alter table public.academy_posts    add column if not exists flag_reason text;
alter table public.academy_comments  add column if not exists status      text not null default 'visible';
alter table public.academy_comments  add column if not exists flag_reason text;
create index if not exists academy_posts_status    on public.academy_posts(mentor_id, status, created_at desc);

-- Silencio temporal + conteo de publicaciones (para el modo "nuevo miembro a revisión").
alter table public.academy_enrollments add column if not exists muted_until timestamptz;
alter table public.academy_enrollments add column if not exists posts_count integer not null default 0;

-- Reportes de la comunidad (cualquier miembro puede denunciar un contenido).
create table if not exists public.academy_reports (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references public.mentors(user_id) on delete cascade,
  reporter_id  uuid not null,
  target_type  text not null,                       -- post | comment | dm | profile | win
  target_id    text not null,
  reason       text,
  status       text not null default 'open',         -- open | resolved | dismissed
  created_at   timestamptz not null default now()
);
create index if not exists academy_reports_open on public.academy_reports(mentor_id, status, created_at desc);
create unique index if not exists academy_reports_uniq on public.academy_reports(mentor_id, reporter_id, target_type, target_id);

-- Historial de sanciones por alumno (aviso / silencio / ban / readmisión).
create table if not exists public.academy_infractions (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references public.mentors(user_id) on delete cascade,
  student_id  uuid not null,
  actor_id    uuid,                                  -- quién aplicó la acción (mentor/colaborador/sistema)
  kind        text not null,                         -- warn | mute | unmute | ban | unban | block
  reason      text,
  until       timestamptz,                           -- para silencios temporales
  created_at  timestamptz not null default now()
);
create index if not exists academy_infractions_student on public.academy_infractions(mentor_id, student_id, created_at desc);

-- Nota: la moderación de IMÁGENES por contenido ya existe en la ruta de subida
-- (lib/academyAI.moderateImage). Esta migración añade la capa de TEXTO y la gestión.
