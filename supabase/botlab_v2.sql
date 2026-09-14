-- ============================================================
-- Onyx Bot Lab v2 · Coinbase (USDT) + chat con traducción automática.
-- Ejecutar tras botlab.sql.
-- ============================================================

-- Coinbase Commerce: url del checkout hospedado por pago cripto.
alter table public.crypto_payments add column if not exists hosted_url text;

-- --- Chat de Bot Lab (una conversación por cliente/lead) ---
create table if not exists public.botlab_threads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,                              -- null = visitante anónimo
  email        text,
  name         text,
  lang         text default 'es',                 -- idioma detectado del cliente
  unread_admin int  not null default 0,           -- mensajes del cliente sin leer
  last_at      timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists botlab_threads_user on public.botlab_threads(user_id);
create index if not exists botlab_threads_last on public.botlab_threads(last_at desc);

-- --- Mensajes: guardamos el ORIGINAL (idioma del cliente) y la versión en ESPAÑOL ---
create table if not exists public.botlab_messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.botlab_threads(id) on delete cascade,
  sender       text not null,                     -- user | admin
  lang         text,                              -- idioma del texto original
  body_orig    text not null,                     -- lo que se muestra a cada quien en su idioma
  body_es      text,                              -- versión en español (lo que ves tú)
  read_admin   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists botlab_messages_thread on public.botlab_messages(thread_id, created_at);
