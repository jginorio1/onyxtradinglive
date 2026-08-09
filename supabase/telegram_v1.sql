-- ============================================
-- Onyx · Telegram (vínculo + preferencias de alertas)
-- Ejecuta este archivo completo en Supabase → SQL Editor.
-- Seguro de repetir: todo va con "if not exists".
-- ============================================

-- Datos del vínculo con Telegram, en el propio perfil
alter table profiles add column if not exists telegram_chat_id   text;      -- id del chat del usuario con el bot
alter table profiles add column if not exists telegram_username   text;      -- @usuario, solo para mostrarlo
alter table profiles add column if not exists telegram_link_code  text;      -- código temporal para vincular
alter table profiles add column if not exists telegram_linked_at   timestamptz;

-- Qué alertas quiere recibir (todo apagado hasta que lo vincule)
alter table profiles add column if not exists tg_alerts        boolean not null default true;  -- interruptor general
alter table profiles add column if not exists tg_blocks        boolean not null default true;  -- el guardian te frenó
alter table profiles add column if not exists tg_limits        boolean not null default true;  -- límite de pérdida / objetivo
alter table profiles add column if not exists tg_manager       boolean not null default false; -- break even, trailing, parciales
alter table profiles add column if not exists tg_funding       boolean not null default true;  -- cerca de una regla de fondeo
alter table profiles add column if not exists tg_daily         boolean not null default false; -- resumen del día

-- Búsqueda rápida por chat_id (el webhook la usa en cada mensaje entrante)
create index if not exists profiles_tg_chat_idx on profiles (telegram_chat_id);
create index if not exists profiles_tg_code_idx on profiles (telegram_link_code);

-- Capacidad por plan: Telegram es de Elite
update plans set capabilities = capabilities || '{"telegram": true}'::jsonb  where id = 'elite';
update plans set capabilities = capabilities || '{"telegram": false}'::jsonb where id in ('free', 'pro');

notify pgrst, 'reload schema';
