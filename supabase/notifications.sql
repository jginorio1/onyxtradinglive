-- ============================================================
-- Centro de mensajes del trader (notificaciones dentro de la app).
-- Correr una vez en Supabase. Idempotente.
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text default 'info',          -- info | support | funding | manager | goal | offline
  title text not null,
  body text,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
