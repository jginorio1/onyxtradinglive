-- ============================================
-- Onyx Trading Live · Equipo robusto + Helpdesk
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- (después de support_v1.sql y support_v2.sql)
-- ============================================

-- Permisos a la carta por miembro (además del rol), disponibilidad para el chat
-- y última actividad.
alter table profiles add column if not exists perms       jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists available   boolean not null default false;
alter table profiles add column if not exists last_active timestamptz;

-- Asignación de conversaciones y canal de origen
alter table support_tickets add column if not exists assignee_id uuid references auth.users(id) on delete set null;
alter table support_tickets add column if not exists channel     text not null default 'ticket';   -- ticket | chat | lead | email
create index if not exists support_tickets_assignee_idx on support_tickets (assignee_id, updated_at desc);

-- Colaboradores invitados a una conversación
create table if not exists ticket_participants (
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

-- Nota: los mensajes internos del equipo se guardan en support_messages con
-- sender = 'note' (no se muestran al trader).

notify pgrst, 'reload schema';
