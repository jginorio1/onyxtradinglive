-- ============================================================
-- Chat estilo WhatsApp: palomitas de leído + adjuntos en soporte,
-- y chat en vivo para empleados (canales, menciones, @Onyx AI).
-- Idempotente: se puede correr varias veces sin romper nada.
-- ============================================================

-- 1) Soporte: leído + adjuntos + quién del equipo escribió ----------
alter table if exists support_messages add column if not exists read_at    timestamptz;
alter table if exists support_messages add column if not exists attachments jsonb default '[]'::jsonb;
alter table if exists support_messages add column if not exists sender_id  uuid;   -- admin que respondió (para avatar/nombre)

-- 2) Chat de equipo: canales -----------------------------------------
create table if not exists chat_channels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null default 'channel',   -- 'channel' (abierto a todo el equipo) | 'dm'
  topic       text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

-- Miembros (solo para DMs; los canales abiertos los ven todos los admin)
create table if not exists chat_members (
  channel_id uuid not null references chat_channels(id) on delete cascade,
  user_id    uuid not null,
  primary key (channel_id, user_id)
);

-- Mensajes del equipo
create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  sender_id   uuid,                         -- null = Onyx AI (bot)
  sender_name text,                         -- copia del nombre/email para no volver a buscarlo
  body        text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  mentions    jsonb not null default '[]'::jsonb,  -- [{type:'user'|'client'|'ticket', id, label}]
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_channel_idx on chat_messages (channel_id, created_at);

-- Marca de lectura por canal y persona (para no leídas)
create table if not exists chat_reads (
  channel_id   uuid not null references chat_channels(id) on delete cascade,
  user_id      uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

-- Canal general por defecto (si aún no hay ninguno)
insert into chat_channels (name, kind, topic)
select 'general', 'channel', 'Canal del equipo'
where not exists (select 1 from chat_channels);

-- ============================================================
-- Storage: bucket 'chat-uploads' para fotos y documentos.
-- Créalo en el panel de Supabase → Storage → New bucket:
--   name = chat-uploads   ·   Public = ON
-- (La API sube con la service role; el bucket público sirve las URLs.)
-- ============================================================
