-- ============================================================
-- Balance real v2: campos de prop firm, reembolso, cuenta y proveedor.
-- Corre esto DESPUÉS de expenses.sql. Idempotente.
-- ============================================================
alter table public.expenses add column if not exists firm text;         -- FTMO, The5ers, MyFundedFX… (solo fondeo)
alter table public.expenses add column if not exists acc_size numeric;    -- tamaño de la cuenta de reto
alter table public.expenses add column if not exists phase text;          -- p1 | p2 | funded | reset
alter table public.expenses add column if not exists account_id uuid references public.trading_accounts(id) on delete set null;
alter table public.expenses add column if not exists refundable boolean not null default false; -- la firma devuelve la tarifa
alter table public.expenses add column if not exists recovered numeric not null default 0;       -- cuánto se recuperó ya
alter table public.expenses add column if not exists provider text;       -- Contabo, TradingView… (cualquier categoría)
