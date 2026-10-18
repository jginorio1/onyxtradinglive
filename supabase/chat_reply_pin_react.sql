-- ============================================================
-- Ola 4 · Chat de equipo: responder/citar, fijar y reacciones.
-- Idempotente: se puede correr varias veces sin romper nada.
-- ============================================================

-- 1) Responder/citar + fijar en los mensajes del equipo ----------------
alter table if exists chat_messages add column if not exists reply_to  uuid references chat_messages(id) on delete set null;
alter table if exists chat_messages add column if not exists pinned     boolean not null default false;
alter table if exists chat_messages add column if not exists pinned_at  timestamptz;
alter table if exists chat_messages add column if not exists pinned_by  uuid;

-- Índice para listar rápido los fijados de un canal.
create index if not exists chat_messages_pinned_idx on chat_messages (channel_id) where pinned;

-- 2) Reacciones (un emoji por persona y mensaje) -----------------------
create table if not exists chat_reactions (
  message_id uuid not null references chat_messages(id) on delete cascade,
  user_id    uuid not null,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists chat_reactions_msg_idx on chat_reactions (message_id);
