-- ============================================
-- Onyx · Telegram — versión a prueba de fallos
-- ============================================
-- Por qué este archivo: en el editor de Supabase, si una línea del script
-- falla, se revierte TODO el bloque. La versión anterior tocaba
-- plans.capabilities al final; si esa columna no existe o es de otro tipo,
-- abortaba y se llevaba por delante las columnas de profiles.
--
-- Aquí las columnas de Telegram van primero, cada una idempotente, y lo de
-- los planes se hace aparte y con manejo de error para que nunca arrastre.
-- Es seguro ejecutarlo aunque ya hubieras corrido el anterior.
-- ============================================

-- 1) Columnas de vínculo y preferencias en profiles (lo que Telegram necesita)
alter table profiles add column if not exists telegram_chat_id   text;
alter table profiles add column if not exists telegram_username   text;
alter table profiles add column if not exists telegram_link_code  text;
alter table profiles add column if not exists telegram_linked_at  timestamptz;

alter table profiles add column if not exists tg_alerts  boolean not null default true;
alter table profiles add column if not exists tg_blocks  boolean not null default true;
alter table profiles add column if not exists tg_limits  boolean not null default true;
alter table profiles add column if not exists tg_manager boolean not null default false;
alter table profiles add column if not exists tg_funding boolean not null default true;
alter table profiles add column if not exists tg_daily   boolean not null default false;

create index if not exists profiles_tg_chat_idx on profiles (telegram_chat_id);
create index if not exists profiles_tg_code_idx on profiles (telegram_link_code);

-- 2) Capacidad por plan (Telegram = Elite). Envuelto: si plans.capabilities
--    no existiera, avisa pero NO revierte las columnas de arriba.
do $$
begin
  update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"telegram": true}'::jsonb  where id = 'elite';
  update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"telegram": false}'::jsonb where id in ('free', 'pro');
exception when others then
  raise notice 'No se pudo actualizar plans.capabilities (%). Las columnas de Telegram sí se crearon.', sqlerrm;
end $$;

notify pgrst, 'reload schema';

-- 3) Comprobación: debe devolver 10 (las 10 columnas nuevas de profiles)
select count(*) as columnas_telegram_creadas
from information_schema.columns
where table_name = 'profiles'
  and column_name in (
    'telegram_chat_id','telegram_username','telegram_link_code','telegram_linked_at',
    'tg_alerts','tg_blocks','tg_limits','tg_manager','tg_funding','tg_daily'
  );
