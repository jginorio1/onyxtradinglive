-- Suscripciones de notificaciones push (Web Push).
-- Cada navegador/dispositivo del usuario guarda aquí su "endpoint" + claves.
-- Correr una vez en Supabase. Idempotente.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz not null default now(),
  unique (endpoint)
);
create index if not exists push_subs_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subs" on public.push_subscriptions;
create policy "own push subs" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
