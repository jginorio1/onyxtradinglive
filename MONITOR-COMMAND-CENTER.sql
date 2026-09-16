-- ============================================================
-- Onyx Command Center — SQL (correr UNA vez en Supabase → SQL Editor)
-- Crea la tabla de HISTORIAL de actividad. La presencia "en vivo" NO usa tabla
-- (va por Realtime). Solo el service role (backend) escribe/lee esta tabla.
-- ============================================================

create table if not exists public.activity_events (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_email text,
  actor_name  text,
  actor_role  text,                       -- 'employee' | 'trader'
  kind        text not null,              -- page | login | connect | purchase | ticket | ea_down | sale | checkin | ...
  path        text,
  label       text,
  country     text,
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Índices para el feed, filtros y "rebobinar sesión".
create index if not exists activity_events_created_idx on public.activity_events (created_at desc);
create index if not exists activity_events_actor_idx   on public.activity_events (actor_id, created_at desc);
create index if not exists activity_events_email_idx   on public.activity_events (actor_email, created_at desc);
create index if not exists activity_events_kind_idx    on public.activity_events (kind, created_at desc);
create index if not exists activity_events_role_idx    on public.activity_events (actor_role, created_at desc);

-- Seguridad: RLS activo y SIN políticas públicas → los clientes no pueden leer/
-- escribir. El backend usa el service role (que salta RLS). El monitoreo es solo
-- para el Admin.
alter table public.activity_events enable row level security;

-- ── Realtime (presencia en vivo) ──────────────────────────────────────────────
-- La presencia usa canales de Broadcast/Presence de Supabase Realtime, que YA
-- vienen activos por defecto. No necesitas habilitar ninguna tabla para esto.
-- (Si en tu proyecto desactivaste Realtime, actívalo en Database → Replication.)
