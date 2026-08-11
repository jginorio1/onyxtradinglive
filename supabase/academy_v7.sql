-- Onyx Academy v7 · programar posts + campañas de email del mentor. Tras academy_v6.sql.

-- Programar publicaciones: si scheduled_at es futuro, el post no se muestra hasta su hora.
alter table public.academy_posts add column if not exists scheduled_at timestamptz;

-- Automatizaciones de email por academia (toggles).
alter table public.mentors add column if not exists email_auto jsonb not null
  default '{"welcome":true,"class_reminder":true,"expiring":true}'::jsonb;

-- Campañas de email (broadcast) del mentor a sus alumnos.
create table if not exists public.academy_emails (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references public.mentors(user_id) on delete cascade,
  subject      text not null,
  body         text not null,
  audience     text not null default 'all',        -- all | active | inactive | expiring
  scheduled_at timestamptz,                          -- null = enviar ya
  status       text not null default 'draft',        -- draft | scheduled | sending | sent
  sent_count   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists academy_emails_mentor on public.academy_emails(mentor_id, created_at desc);
create index if not exists academy_emails_due on public.academy_emails(status, scheduled_at);

-- Registro para no repetir envíos automáticos (bienvenida, recordatorio, expiración).
create table if not exists public.academy_email_log (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null,
  student_id uuid not null,
  kind       text not null,          -- welcome | class_reminder | expiring | campaign
  ref        text not null default '',
  created_at timestamptz not null default now(),
  unique (mentor_id, student_id, kind, ref)
);
