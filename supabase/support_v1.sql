-- ============================================
-- Onyx Trading Live · Centro de soporte
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Un ticket = una consulta del trader. status: open | in_progress | resolved
create table if not exists support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text,
  subject     text not null,
  category    text not null default 'general',   -- general | conexion | facturacion | guardian | instalacion
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on support_tickets (user_id, updated_at desc);
create index if not exists support_tickets_status_idx on support_tickets (status, updated_at desc);

-- Cada mensaje dentro de un ticket. sender: user | admin | ai
create table if not exists support_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references support_tickets(id) on delete cascade,
  sender      text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on support_messages (ticket_id, created_at);

notify pgrst, 'reload schema';
