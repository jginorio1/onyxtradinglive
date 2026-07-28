-- ============================================================
-- Helpdesk de soporte: prioridad de ticket + respuestas guardadas.
-- Correr una sola vez en el SQL Editor de Supabase.
-- Todo es idempotente (se puede correr de nuevo sin romper nada).
-- ============================================================

-- 1) Prioridad del ticket: low | normal | high  (por defecto normal)
alter table support_tickets add column if not exists priority text default 'normal';

-- 2) Respuestas guardadas (canned responses) que el equipo reutiliza
create table if not exists support_canned (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  lang        text not null default 'es',   -- es | en
  created_by  text,                          -- correo del admin que la creó
  created_at  timestamptz not null default now()
);

-- Solo el backend (service role) las lee/escribe. Bloqueamos el acceso
-- público habilitando RLS sin políticas (service role igual pasa).
alter table support_canned enable row level security;

-- Índice para ordenar por más recientes
create index if not exists support_canned_created_idx on support_canned (created_at desc);

-- 3) Onboarding por correo: registra qué pasos de la secuencia ya recibió cada
--    usuario, para no repetirlos. Ej: {"welcome":"2026-07-27","connect":"..."}
alter table profiles add column if not exists onboarding_emails jsonb not null default '{}'::jsonb;
