-- ============================================
-- Onyx Trading Live · Claves atadas a la cuenta
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Cada clave API pertenece a UNA cuenta de trading
alter table api_keys add column if not exists account_login bigint;   -- se ata sola en el primer sync
alter table api_keys add column if not exists broker text;            -- FTMO, The5ers, Axi, ...
alter table api_keys add column if not exists acc_type text;          -- challenge | funded | own | demo
alter table api_keys add column if not exists acc_size numeric;       -- tamaño de la cuenta fondeada
alter table api_keys add column if not exists currency text default 'USD';

-- Datos de la cuenta de trading (por si el usuario los declara antes del primer sync)
alter table trading_accounts add column if not exists acc_size numeric;

-- Un mismo número de cuenta no puede tener dos claves activas del mismo usuario
create unique index if not exists api_keys_user_login_idx
  on api_keys (user_id, account_login)
  where account_login is not null and revoked = false;

notify pgrst, 'reload schema';
