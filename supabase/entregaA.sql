-- ============================================================
-- Onyx · ENTREGA A: centro de cuentas
-- Tipo de cuenta, estado del challenge, coste, retiros/pagos y documentos.
-- Ejecuta en Supabase → SQL Editor (proyecto aohupkoamqnmeyqduuxa). Seguro de re-ejecutar.
-- ============================================================

-- Campos nuevos en la cuenta
alter table trading_accounts add column if not exists acc_type         text;    -- challenge | funded | own | demo
alter table trading_accounts add column if not exists challenge_status text;    -- running | passed | failed
alter table trading_accounts add column if not exists challenge_cost   numeric; -- lo que pagaste por el reto

-- Retiros / pagos recibidos por cuenta
create table if not exists payouts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  account_id  uuid not null references trading_accounts(id) on delete cascade,
  amount      numeric not null default 0,
  date        date,
  note        text,
  receipt_url text,
  created_at  timestamptz default now()
);
alter table payouts enable row level security;
drop policy if exists "own payouts" on payouts;
create policy "own payouts" on payouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_payouts_user on payouts(user_id);
create index if not exists idx_payouts_acc  on payouts(account_id);

-- Documentos por cuenta (certificados, comprobantes, facturas…)
create table if not exists account_documents (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references trading_accounts(id) on delete cascade,
  doc_type   text not null default 'certificate',  -- certificate | payout | invoice | kyc | other
  title      text,
  image_url  text,
  created_at timestamptz default now()
);
alter table account_documents enable row level security;
drop policy if exists "own docs" on account_documents;
create policy "own docs" on account_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_docs_user on account_documents(user_id);
create index if not exists idx_docs_acc  on account_documents(account_id);

notify pgrst, 'reload schema';
