-- ============================================
-- Onyx · Telegram v2 — más tipos de alerta
-- Ejecuta este archivo completo en Supabase → SQL Editor. Seguro de repetir.
-- ============================================

-- Interruptores nuevos en el perfil
alter table profiles add column if not exists tg_offline boolean not null default true;  -- Guardian sin señal
alter table profiles add column if not exists tg_goal    boolean not null default true;  -- objetivo de fondeo / challenge

-- Marca para no repetir avisos "de una vez al día" (funding, offline, daily…).
-- Guarda { "funding": "2026-07-22", "offline": "...", "daily": "..." } por cuenta o global.
alter table profiles add column if not exists tg_sent jsonb not null default '{}'::jsonb;

-- La cuenta recuerda si ya avisamos de que pasó el challenge / llegó al objetivo,
-- para no felicitar cada vez que sincroniza.
alter table trading_accounts add column if not exists goal_notified_at timestamptz;

-- Comprobación: debe devolver 3
select count(*) as columnas_nuevas
from information_schema.columns
where (table_name = 'profiles' and column_name in ('tg_offline','tg_goal','tg_sent'))
   or (table_name = 'trading_accounts' and column_name = 'goal_notified_at');

notify pgrst, 'reload schema';
