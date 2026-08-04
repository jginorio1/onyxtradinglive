-- ============================================================
-- Robots v2: un bot se identifica por CUENTA + magic number (antes solo por magic,
-- lo que mezclaba cuentas). Así una misma cuenta puede tener todos los bots que
-- quiera, cada uno por su magic, y dos cuentas no se pisan aunque compartan magic.
-- Correr una sola vez en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- 1) Atar cada configuración de bot a una cuenta concreta.
alter table bots add column if not exists account_id uuid references trading_accounts(id) on delete cascade;

-- 2) Backfill: si una config (magic) tiene operaciones en una sola cuenta del dueño,
--    la atamos a esa cuenta. Si opera en varias, se deja como estaba (global/legacy).
update bots b
set account_id = sub.account_id
from (
  select t.magic, min(t.account_id) as account_id, count(distinct t.account_id) as n
  from trades t
  where t.magic is not null and t.magic <> 0
  group by t.magic
) sub
where b.account_id is null
  and b.magic = sub.magic
  and sub.n = 1
  and sub.account_id in (select id from trading_accounts where user_id = b.user_id);

-- 3) Quitar la unicidad vieja (user_id, magic) que impedía el mismo magic en dos cuentas.
alter table bots drop constraint if exists bots_user_id_magic_key;

-- 4) Nueva unicidad por (usuario, cuenta, magic). Filas legacy con account_id NULL
--    conviven sin chocar (NULL se trata como distinto en índices únicos).
create unique index if not exists bots_user_acc_magic_uidx on bots (user_id, account_id, magic);
create index if not exists bots_account_idx on bots (account_id);
