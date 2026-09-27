-- ============================================================
-- Kit de reclutamiento de embajadores: prospectos (mini-CRM).
-- Correr una vez en Supabase. Idempotente.
-- ============================================================
create table if not exists public.ambassador_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- nombre o @handle del creador
  platform text default 'youtube',    -- youtube | instagram | tiktok | telegram | x | other
  niche text default 'prop',          -- prop | beginners | signals | forex | crypto | other
  handle text,                        -- @usuario o URL del canal
  email text,                         -- para enviar la invitación
  status text not null default 'new', -- new | contacted | replied | joined | passed
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists amb_prospects_status on public.ambassador_prospects (status, created_at desc);
alter table public.ambassador_prospects enable row level security;
