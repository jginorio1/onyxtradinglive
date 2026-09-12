-- ============================================
-- Onyx · Arreglo: la tabla de pagos de embajadores
-- ============================================
-- Problema: 'payouts' ya existia para los retiros de cuentas fondeadas,
-- asi que la tabla de pagos de embajadores nunca llego a crearse.
-- Solucion: usarla con su propio nombre.
--
-- Ejecuta este archivo en Supabase → SQL Editor.

create table if not exists ambassador_payouts (
  id uuid primary key default uuid_generate_v4(),
  ambassador_id uuid not null references ambassadors(id) on delete cascade,
  amount numeric not null,
  method text,
  details text,
  status text not null default 'requested',     -- requested | paid | rejected
  note text,
  requested_at timestamptz default now(),
  paid_at timestamptz
);

create index if not exists ambassador_payouts_amb_idx on ambassador_payouts (ambassador_id, status);

notify pgrst, 'reload schema';
