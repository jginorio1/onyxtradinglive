-- Referidos del VENDEDOR: quien comparte el enlace de un robot se lleva un % del
-- NETO del vendedor (después de la comisión de Onyx). Orden del reparto por venta:
--   Onyx (fee) → del resto, el referido (affiliate_pct del vendedor) → vendedor.
alter table bot_products add column if not exists affiliate_pct numeric default 0;
comment on column bot_products.affiliate_pct is 'Del NETO del vendedor, % para quien refiere la venta (0–80).';

-- Guardamos el referido en el pago para poder repartir al confirmar.
alter table crypto_payments add column if not exists referrer_id uuid;
alter table bot_purchases  add column if not exists referrer_id uuid;

create table if not exists bot_referrals (
  id uuid primary key default gen_random_uuid(),
  product_id       uuid,
  seller_id        uuid,
  referrer_id      uuid not null,
  buyer_id         uuid,
  gross_cents      integer not null default 0,
  onyx_fee_cents   integer not null default 0,
  seller_net_cents integer not null default 0,
  affiliate_cents  integer not null default 0,
  affiliate_pct    numeric not null default 0,
  method           text,
  ref              text,
  status           text not null default 'earned',   -- earned | paid | reversed
  created_at       timestamptz not null default now(),
  paid_at          timestamptz
);
create unique index if not exists bot_referrals_ref_uq on bot_referrals (referrer_id, ref);
create index if not exists bot_referrals_referrer_idx on bot_referrals (referrer_id);
