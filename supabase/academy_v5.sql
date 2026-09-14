-- Onyx Academy v5 · membresía de pago (mensual) + landing de ventas.
-- Ejecutar tras academy_v4.sql.

-- Precio de membresía de la comunidad. 0 = academia gratis. >0 = de pago: hay que
-- suscribirse para entrar (los niveles/cursos internos siguen siendo upsells).
alter table public.mentors add column if not exists membership_price_cents int not null default 0;
alter table public.mentors add column if not exists membership_currency  text not null default 'usd';
alter table public.mentors add column if not exists membership_interval  text not null default 'month'; -- month | year
alter table public.mentors add column if not exists intro_video_url       text;   -- video de presentación (YouTube/Vimeo/.mp4)
alter table public.mentors add column if not exists pitch                 text;   -- descripción de ventas larga

-- Suscripciones de membresía de los alumnos a una comunidad de pago.
create table if not exists public.academy_memberships (
  id             uuid primary key default gen_random_uuid(),
  mentor_id      uuid not null,
  student_id     uuid not null,
  status         text not null default 'active',      -- active | canceled | past_due
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at     timestamptz not null default now(),
  unique (mentor_id, student_id)
);
create index if not exists academy_memberships_student on public.academy_memberships(student_id);
create index if not exists academy_memberships_sub on public.academy_memberships(stripe_subscription_id);
