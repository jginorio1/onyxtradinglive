-- ============================================
-- Onyx Trading Live · Entrega 1: Mi cuenta
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Datos de perfil que el usuario puede editar
alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists timezone text default 'UTC';
alter table profiles add column if not exists lang text default 'es';

-- Preferencias de notificaciones
alter table profiles add column if not exists notify_email boolean not null default true;
alter table profiles add column if not exists notify_weekly boolean not null default true;
alter table profiles add column if not exists notify_funding boolean not null default true;
alter table profiles add column if not exists notify_marketing boolean not null default false;

-- Motivo de cancelación (lo usaremos en la entrega de retención)
alter table profiles add column if not exists cancel_reason text;
alter table profiles add column if not exists canceled_at timestamptz;

notify pgrst, 'reload schema';
