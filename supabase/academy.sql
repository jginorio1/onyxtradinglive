-- Onyx Academy (estilo Skool) · comunidad + cursos. Ejecutar en el SQL Editor de Supabase.
-- Un mentor tiene UNA academia (mentors). Publica módulos y lecciones (con vídeo).
-- Los alumnos se inscriben por el código del mentor y ven el contenido + comunidad.

create table if not exists public.mentors (
  user_id      uuid primary key,
  code         text unique not null,               -- código/slug para el enlace de inscripción
  academy_name text not null default 'Mi academia',
  tagline      text,
  about        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.academy_modules (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references public.mentors(user_id) on delete cascade,
  title       text not null,
  description text,
  position    int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists academy_modules_mentor on public.academy_modules(mentor_id, position);

create table if not exists public.academy_lessons (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.academy_modules(id) on delete cascade,
  mentor_id   uuid not null,
  title       text not null,
  video_url   text,                                -- YouTube/Vimeo/mp4
  content     text,                                -- notas / texto de la lección
  resources   jsonb not null default '[]'::jsonb,  -- [{label,url}]
  position    int not null default 0,
  is_free     boolean not null default false,      -- preview gratis sin inscribirse
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists academy_lessons_module on public.academy_lessons(module_id, position);

create table if not exists public.academy_enrollments (
  mentor_id   uuid not null references public.mentors(user_id) on delete cascade,
  student_id  uuid not null,
  status      text not null default 'active',       -- active | removed
  joined_at   timestamptz not null default now(),
  primary key (mentor_id, student_id)
);
create index if not exists academy_enroll_student on public.academy_enrollments(student_id);

create table if not exists public.lesson_progress (
  student_id   uuid not null,
  lesson_id    uuid not null references public.academy_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

-- Comunidad (feed estilo Skool): posts del mentor y alumnos + comentarios.
create table if not exists public.academy_posts (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.mentors(user_id) on delete cascade,
  author_id  uuid not null,
  body       text not null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists academy_posts_mentor on public.academy_posts(mentor_id, created_at desc);

create table if not exists public.academy_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.academy_posts(id) on delete cascade,
  author_id  uuid not null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists academy_comments_post on public.academy_comments(post_id, created_at);

-- Capacidad de plan: quien pueda SER mentor lleva capabilities.academy = true
-- (plan "Mentor" o add-on). Los alumnos no necesitan capacidad para inscribirse.
