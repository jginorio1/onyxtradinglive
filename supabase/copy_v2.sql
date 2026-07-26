-- Onyx Copy Trading · esquema Fase 2
-- Añade: claves Copy identificadas (separadas de Guardian), interruptores de
-- pausa (global / por cuenta / por enlace ya existe), PIN de copy para reanudar,
-- y controles de riesgo por enlace. Ejecutar en Supabase SQL Editor.
-- Todo con "if not exists": es seguro repetirlo.

-- 1) Claves identificadas: guardian (sync normal) vs copy (copy trading).
--    Las claves existentes quedan como 'guardian' por defecto.
alter table if exists public.api_keys
  add column if not exists kind text not null default 'guardian';   -- guardian | copy
create index if not exists api_keys_kind on public.api_keys(user_id, kind) where revoked = false;

-- El índice único viejo era (user_id, account_login) y NO dejaba tener a la vez
-- la clave Guardian y la clave Copy de la MISMA cuenta. Lo recreamos incluyendo
-- 'kind' para permitir una de cada tipo por cuenta.
drop index if exists api_keys_user_login_idx;
create unique index if not exists api_keys_user_login_kind_idx
  on public.api_keys (user_id, account_login, kind)
  where account_login is not null and revoked = false;

-- 2) Interruptores de copia (control remoto desde web/Telegram).
--    Pausa GLOBAL del trader (kill switch) + PIN para reanudar.
alter table if exists public.profiles
  add column if not exists copy_paused boolean not null default false,
  add column if not exists copy_pin_hash text,                       -- pbkdf2, opcional
  add column if not exists copy_paused_at timestamptz;

--    Pausa por CUENTA (una master o una esclava concreta).
alter table if exists public.trading_accounts
  add column if not exists copy_paused boolean not null default false;

--    Preferencias de avisos por Telegram del copy trading.
alter table if exists public.profiles
  add column if not exists tg_copy_paused boolean not null default true,   -- copia pausada / reanudada
  add column if not exists tg_copy_error  boolean not null default true;   -- fallo al copiar (símbolo, spread, etc.)

--    Cuentas Master extra compradas como add-on (por encima de la base del plan).
alter table if exists public.profiles
  add column if not exists extra_masters int not null default 0;

-- 3) Controles de riesgo por enlace (se configuran desde el tab, no en la EA).
--    El servidor aplica sesión y whitelist (no crea el comando); la EA esclava
--    aplica lote/spread/pérdida diaria/drawdown en su lado.
alter table if exists public.copy_links
  add column if not exists daily_loss_pct  numeric not null default 0,   -- 0 = sin límite
  add column if not exists max_drawdown_pct numeric not null default 0,  -- 0 = sin límite
  add column if not exists max_spread       numeric not null default 0,  -- puntos; 0 = sin límite
  add column if not exists session_from     text,                        -- "HH:MM" UTC, null = 24h
  add column if not exists session_to       text,
  add column if not exists symbol_whitelist jsonb not null default '[]'::jsonb; -- [] = todos

-- 4) Registro de acciones de control (auditoría de pausar/reanudar).
create table if not exists public.copy_control_log (
  id bigserial primary key,
  owner_id uuid not null,
  action text not null,                 -- pause_all | resume_all | pause_account | resume_account | pause_link | resume_link
  target text,                          -- id de cuenta o enlace afectado
  source text not null default 'web',   -- web | telegram | auto
  created_at timestamptz not null default now()
);
create index if not exists copy_control_log_owner on public.copy_control_log(owner_id, created_at desc);
