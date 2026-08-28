-- ============================================================
-- Campañas de correo (seguimiento automático + envíos manuales).
-- Correr una vez en Supabase. Idempotente.
-- ============================================================

-- Plantillas/campañas. Una fila por campaña. El "cuerpo" y "asunto" son
-- editables desde Admin → Campañas, bilingües (es/en).
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  key text unique,                         -- clave estable para campañas automáticas (ej. 'no_connect'); null para manuales
  name text not null,                      -- nombre visible en el panel
  kind text not null default 'trigger',    -- trigger | scheduled | manual
  segment text not null default 'all',     -- id de segmento (ver lib/segments.ts)
  subject_es text default '',
  body_es text default '',
  subject_en text default '',
  body_en text default '',
  enabled boolean not null default false,   -- las automáticas empiezan apagadas
  trigger jsonb default '{}'::jsonb,        -- { days: 3 } etc. para las 'trigger'
  schedule text default '',                 -- cron para las 'scheduled' (informativo)
  scheduled_at timestamptz,                 -- promo programada: sale a esta fecha/hora y se limpia
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_kind on public.campaigns (kind);

-- Registro de a quién se le envió qué (dedupe: nunca el mismo correo dos veces).
create table if not exists public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  campaign_key text,                        -- copia estable por si se borra la campaña
  user_id uuid,
  email text not null,
  status text default 'sent',               -- sent | failed | bounced | complained
  resend_id text,                           -- id del mensaje en Resend (para correlacionar el webhook)
  delivered_at timestamptz,
  opened_at timestamptz,                     -- primera apertura
  clicked_at timestamptz,                    -- primer clic
  created_at timestamptz not null default now()
);

-- Por si las tablas YA existían de una corrida anterior: añade las columnas
-- nuevas (create table if not exists no las agrega a una tabla existente).
alter table public.campaigns      add column if not exists scheduled_at timestamptz;
alter table public.campaign_sends add column if not exists resend_id    text;
alter table public.campaign_sends add column if not exists delivered_at timestamptz;
alter table public.campaign_sends add column if not exists opened_at    timestamptz;
alter table public.campaign_sends add column if not exists clicked_at   timestamptz;

create index if not exists campaign_sends_rid on public.campaign_sends (resend_id);
create index if not exists campaign_sends_cam on public.campaign_sends (campaign_id, created_at desc);
create index if not exists campaign_sends_user on public.campaign_sends (user_id, campaign_key);
create index if not exists campaign_sends_at on public.campaign_sends (created_at desc);

alter table public.campaigns enable row level security;
alter table public.campaign_sends enable row level security;

-- Opt-out de marketing (separado de notify_email, que es transaccional) y token
-- para el enlace de baja de un solo clic.
alter table public.profiles add column if not exists marketing_emails boolean default true;
alter table public.profiles add column if not exists unsub_token text;
