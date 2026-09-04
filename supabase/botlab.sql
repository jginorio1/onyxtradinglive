-- ============================================================
-- Onyx Bot Lab · marketplace de robots + servicios a medida + pagos (tarjeta/USDT).
-- Reusa profiles / bots / plans y el Stripe Connect ya existente.
-- Ejecutar una sola vez en el mismo Supabase.
-- ============================================================

-- --- Vendedor de robots (el trader que publica y cobra) ---
-- Reusamos profiles. Una cuenta Stripe Express propia para el marketplace
-- (separada de la de mentor de la academia) + su método de cobro preferido.
alter table public.profiles add column if not exists bot_stripe_account_id text;
alter table public.profiles add column if not exists bot_charges_enabled boolean not null default false;
alter table public.profiles add column if not exists bot_seller boolean not null default false;
alter table public.profiles add column if not exists payout_method text;         -- bank | usdt
alter table public.profiles add column if not exists payout_usdt_address text;

-- --- Productos: robots publicados a la venta (por Onyx o por un creador) ---
create table if not exists public.bot_products (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid references public.profiles(id) on delete set null,  -- null = Onyx oficial
  bot_id        uuid,                                   -- opcional: liga a un bot real del creador
  name          text not null,
  tagline       text,
  description   text,
  kind          text not null default 'subscription',  -- subscription | one_time
  interval      text not null default 'month',          -- month | year
  price_cents   int  not null default 0,
  currency      text not null default 'usd',
  platform      text not null default 'any',            -- mt4 | mt5 | ctrader | any
  pair          text,
  category      text,                                    -- scalping | trend | grid | news | ...
  cover_url     text,
  perf          jsonb not null default '{}'::jsonb,      -- {score,ret90,dd,winrate} para mostrar
  is_official   boolean not null default false,          -- construido por Onyx
  verified      boolean not null default false,          -- track record validado
  status        text not null default 'draft',           -- draft | pending | active | rejected | paused
  accepts_card  boolean not null default true,
  accepts_crypto boolean not null default true,
  sales         int  not null default 0,
  rating        numeric,
  reviews       int  not null default 0,
  position      int  not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists bot_products_seller on public.bot_products(seller_id);
create index if not exists bot_products_status on public.bot_products(status, position);

-- --- Compras / licencias (dan acceso a activar el robot) ---
create table if not exists public.bot_purchases (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.bot_products(id) on delete cascade,
  buyer_id      uuid not null,
  seller_id     uuid,                                    -- null si es Onyx oficial
  kind          text not null,                           -- subscription | one_time
  status        text not null default 'pending',         -- pending | active | canceled | past_due
  method        text not null default 'card',            -- card | usdt
  price_cents   int  not null default 0,
  currency      text not null default 'usd',
  stripe_session_id      text,
  stripe_subscription_id text,
  crypto_payment_id      uuid,
  current_period_end     timestamptz,
  created_at    timestamptz not null default now(),
  unique (buyer_id, product_id)
);
create index if not exists bot_purchases_buyer on public.bot_purchases(buyer_id);
create index if not exists bot_purchases_seller on public.bot_purchases(seller_id);
create index if not exists bot_purchases_sub on public.bot_purchases(stripe_subscription_id);

-- --- Libro de comisiones de Onyx sobre el marketplace ---
create table if not exists public.bot_commissions (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid,
  buyer_id     uuid,
  product_id   uuid,
  gross_cents  int  not null default 0,
  fee_cents    int  not null default 0,
  currency     text not null default 'usd',
  kind         text,                                     -- subscription | one_time | membership
  method       text not null default 'card',             -- card | usdt
  status       text not null default 'earned',           -- earned | reversed
  ref          text,                                     -- id único de Stripe/cripto (idempotencia)
  created_at   timestamptz not null default now(),
  reversed_at  timestamptz,
  unique (seller_id, ref)
);
create index if not exists bot_commissions_at on public.bot_commissions(created_at);

-- --- Solicitudes de servicio (automatiza mi estrategia / instalación / elite) ---
create table if not exists public.bot_service_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,                                      -- null si es lead anónimo
  email       text,
  name        text,
  service     text not null,                             -- automate | install | elite
  platform    text,
  budget      text,
  message     text,
  status      text not null default 'new',               -- new | contacted | in_progress | won | lost
  lang        text default 'es',
  created_at  timestamptz not null default now()
);
create index if not exists bot_service_created on public.bot_service_requests(created_at desc);
create index if not exists bot_service_status on public.bot_service_requests(status);

-- --- Pagos a creadores (payouts) ---
create table if not exists public.bot_payouts (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null,
  amount_cents int not null default 0,
  currency    text not null default 'usd',
  method      text not null default 'stripe',            -- stripe | bank | usdt
  destination text,
  status      text not null default 'pending',           -- pending | paid
  note        text,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
create index if not exists bot_payouts_seller on public.bot_payouts(seller_id, created_at desc);

-- --- Pagos en cripto (USDT) para licencias o servicios ---
create table if not exists public.crypto_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  purpose     text not null,                             -- license | service
  ref_id      uuid,                                      -- product_id o service_request_id
  amount_usd  numeric not null default 0,
  asset       text not null default 'USDT',
  network     text,                                      -- trc20 | erc20 | bep20
  address     text,                                      -- dirección a la que paga
  txid        text,                                      -- hash que reporta el usuario
  status      text not null default 'pending',           -- pending | confirmed | rejected
  provider    text,                                      -- manual | nowpayments | ...
  provider_id text,
  created_at  timestamptz not null default now(),
  confirmed_at timestamptz
);
create index if not exists crypto_payments_user on public.crypto_payments(user_id, created_at desc);
create index if not exists crypto_payments_status on public.crypto_payments(status);
