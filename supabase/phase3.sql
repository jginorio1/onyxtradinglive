-- ============================================================
-- Onyx · FASE 3: diario por operación (notas, etiquetas, fotos) + reglas de fondeo
-- Ejecuta en Supabase → SQL Editor (proyecto aohupkoamqnmeyqduuxa)
-- Seguro de re-ejecutar.
-- ============================================================

-- Diario por operación
create table if not exists trade_journal (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  trade_id   uuid not null references trades(id) on delete cascade,
  notes      text,
  tags       text[] not null default '{}',
  emotion    text,
  image_url  text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (trade_id)
);

alter table trade_journal enable row level security;
drop policy if exists "own journal" on trade_journal;
create policy "own journal" on trade_journal for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_journal_user on trade_journal(user_id);

-- Reglas de fondeo por cuenta (opcionales, editables desde el dashboard)
alter table trading_accounts add column if not exists fund_target    numeric;  -- objetivo de profit ($)
alter table trading_accounts add column if not exists fund_max_daily numeric;  -- pérdida diaria máx ($)
alter table trading_accounts add column if not exists fund_max_total numeric;  -- pérdida total máx ($)
alter table trading_accounts add column if not exists fund_start     numeric;  -- balance inicial ($)

notify pgrst, 'reload schema';
