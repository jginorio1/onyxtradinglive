-- Onyx Academy v8 · certificados + afiliados del mentor + auditoría AI. Tras academy_v7.sql.

-- Certificados al completar un curso (o toda la academia).
create table if not exists public.academy_certificates (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null,
  student_id uuid not null,
  kind       text not null default 'course',   -- course | academy
  module_id  uuid,
  title      text not null,
  code       text not null unique,             -- para verificar/compartir
  issued_at  timestamptz not null default now(),
  unique (mentor_id, student_id, kind, module_id)
);
create index if not exists academy_cert_student on public.academy_certificates(student_id);

-- Afiliados: cada miembro invita; si trae miembros que PAGAN, se registra el referido.
-- No mueve dinero automáticamente (seguridad): es un libro para que el mentor premie.
alter table public.mentors add column if not exists affiliate_reward_cents int not null default 0;
alter table public.mentors add column if not exists affiliate_currency text not null default 'usd';

create table if not exists public.academy_referrals (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null,
  referrer_id  uuid not null,                  -- quién invitó
  referred_id  uuid not null,                  -- quién se unió
  paid         boolean not null default false, -- ¿el referido ya pagó algo?
  reward_cents int not null default 0,         -- recompensa acreditada al referidor
  created_at   timestamptz not null default now(),
  unique (mentor_id, referred_id)
);
create index if not exists academy_ref_mentor on public.academy_referrals(mentor_id);
create index if not exists academy_ref_referrer on public.academy_referrals(referrer_id);

-- Auditoría AI del alumno (boletín del mentor sobre el trading real del alumno).
create table if not exists public.academy_audits (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null,
  student_id uuid not null,
  period     text not null default '30d',
  metrics    jsonb,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists academy_audit_student on public.academy_audits(student_id, created_at desc);
