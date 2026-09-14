-- ============================================================
-- Onyx Copy — Marketplace F2/F3: ejecución de copia + cobro (Stripe Connect)
-- Correr una vez en Supabase → SQL Editor. Idempotente.
--
-- F2: un seguidor "sigue" a un proveedor; al activarse se crea un copy_links
--     (master = cuenta del proveedor, slave = cuenta del seguidor) con SUS
--     controles de riesgo. El motor de copia existente hace el resto.
-- F3: el seguidor paga una suscripción mensual (Stripe Connect). Onyx retiene su
--     comisión (application_fee) y el resto va al trader calificado.
-- ============================================================

-- Cuenta Stripe Connect del trader calificado (por usuario, para cobrar copias).
alter table profiles add column if not exists copy_stripe_account_id text;
alter table profiles add column if not exists copy_charges_enabled boolean not null default false;

-- El proveedor guarda su precio/estado de cobro (fee_month ya existe en F1).
alter table strategy_providers add column if not exists payable boolean not null default false;

-- Seguidores: quién copia a quién, con sus controles de riesgo y su suscripción.
create table if not exists copy_follows (
  id                  uuid primary key default gen_random_uuid(),
  follower_id         uuid not null,
  provider_id         uuid not null references strategy_providers(id) on delete cascade,
  follower_account_id uuid not null,
  link_id             uuid,                          -- copy_links.id creado al activar
  lot_mode            text not null default 'balance',   -- balance | multiplier | fixed | risk
  lot_value           numeric not null default 1,        -- multiplicador / lote fijo / % riesgo
  max_lot             numeric not null default 5,
  max_drawdown_pct    numeric not null default 0,
  require_sl          boolean not null default false,
  reverse             boolean not null default false,
  price_month         numeric,
  stripe_sub_id       text,
  status              text not null default 'pending',   -- pending | active | past_due | paused | canceled
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (follower_account_id, provider_id)
);
create index if not exists copy_follows_follower_idx on copy_follows (follower_id);
create index if not exists copy_follows_provider_idx on copy_follows (provider_id, status);
create index if not exists copy_follows_sub_idx on copy_follows (stripe_sub_id);

-- Libro de comisiones de copia (para el panel de cobros del trader). Idempotente
-- por factura: reintentos del webhook no duplican.
create table if not exists copy_follow_commissions (
  id           uuid primary key default gen_random_uuid(),
  provider_id  uuid,
  follow_id    uuid,
  gross_cents  int not null default 0,
  fee_cents    int not null default 0,     -- comisión de Onyx (application fee)
  net_cents    int not null default 0,     -- lo que recibe el trader
  currency     text not null default 'usd',
  invoice_id   text unique,
  created_at   timestamptz not null default now()
);
create index if not exists copy_commissions_provider_idx on copy_follow_commissions (provider_id, created_at desc);

alter table copy_follows enable row level security;
alter table copy_follow_commissions enable row level security;

notify pgrst, 'reload schema';
