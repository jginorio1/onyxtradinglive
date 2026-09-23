-- ============================================================
-- Tokens de notificaciones push NATIVAS (app Android/iOS · Firebase FCM).
-- Ejecútalo en Supabase → SQL Editor UNA vez.
-- ============================================================
create table if not exists native_push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,          -- token del dispositivo (FCM)
  platform    text not null default 'android',
  ua          text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists native_push_tokens_user_idx on native_push_tokens(user_id);

-- Solo el servidor (service role) lee/escribe estos tokens; RLS cerrado.
alter table native_push_tokens enable row level security;
