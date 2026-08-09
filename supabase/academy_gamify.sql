-- Onyx Academy · gamificación estilo Skool + portadas. Ejecutar tras academy.sql.

-- Portadas / imagen para el look de "classroom" y la cabecera de la comunidad.
alter table public.academy_modules add column if not exists cover_url text;
alter table public.mentors        add column if not exists cover_url text;

-- Likes de posts y comentarios (dan puntos al autor, como en Skool).
create table if not exists public.academy_likes (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null,               -- 'post' | 'comment'
  target_id   uuid not null,
  user_id     uuid not null,
  mentor_id   uuid not null,               -- comunidad a la que pertenece
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);
create index if not exists academy_likes_target on public.academy_likes(target_type, target_id);
create index if not exists academy_likes_mentor_at on public.academy_likes(mentor_id, created_at);

-- Puntos acumulados por miembro en cada comunidad (all-time). El nivel se calcula
-- a partir de los puntos con los umbrales de Skool (en lib/academy.ts).
create table if not exists public.academy_points (
  mentor_id  uuid not null,
  user_id    uuid not null,
  points     int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (mentor_id, user_id)
);
create index if not exists academy_points_board on public.academy_points(mentor_id, points desc);
