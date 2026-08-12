-- ============================================================
-- Onyx Academy v24 · Pagos a los referidos del mentor (rieles A + B).
--  Riel A = crédito en la academia (Stripe customer balance, automático).
--  Riel B = pago manual fuera de plataforma (efectivo/PayPal/Zelle/banco).
-- Cada recompensa tiene ciclo de vida: pending → available → paid | reversed.
-- academy_referrals se conserva SOLO para la atribución (quién trajo a quién).
-- ============================================================

-- ---- Ajustes de afiliado por mentor ----
alter table public.mentors add column if not exists affiliate_type      text    not null default 'flat';   -- 'flat' | 'pct'
alter table public.mentors add column if not exists affiliate_pct       numeric not null default 0;        -- % de la venta cuando type='pct'
alter table public.mentors add column if not exists affiliate_recurring boolean not null default false;    -- pagar también en cada renovación
alter table public.mentors add column if not exists affiliate_hold_days int     not null default 14;       -- ventana anti-reembolso
alter table public.mentors add column if not exists affiliate_min_cents int     not null default 0;        -- mínimo para pagar
alter table public.mentors add column if not exists affiliate_rail      text    not null default 'manual'; -- 'credit' | 'manual'
-- (ya existían: affiliate_reward_cents, affiliate_currency)

-- ---- Libro de recompensas por evento (una por factura/pago) ----
create table if not exists public.academy_reward_events (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null,
  referrer_id  uuid not null,                    -- quién cobra
  referred_id  uuid not null,                    -- quién pagó su membresía/nivel
  amount_cents int  not null default 0,
  currency     text not null default 'usd',
  status       text not null default 'pending',  -- pending | available | paid | reversed
  rail         text not null default 'manual',   -- credit | manual (cómo se paga)
  stripe_ref   text,                             -- invoice.id o payment_intent (idempotencia + reversión)
  kind         text not null default 'first',    -- first | renewal | one_time
  available_at timestamptz,                      -- cuándo pasa de en-espera a disponible
  paid_at      timestamptz,
  paid_method  text,                             -- credit | paypal | zelle | bank | cash | other
  paid_note    text,
  payout_id    uuid,                             -- lote de pago (academy_referral_payouts)
  reversed_at  timestamptz,
  created_at   timestamptz not null default now()
);
-- Idempotencia: un reintento del webhook no duplica la recompensa de la misma factura.
create unique index if not exists academy_reward_ref  on public.academy_reward_events(mentor_id, stripe_ref) where stripe_ref is not null;
create index if not exists academy_reward_mentor       on public.academy_reward_events(mentor_id);
create index if not exists academy_reward_referrer     on public.academy_reward_events(referrer_id);
create index if not exists academy_reward_status       on public.academy_reward_events(mentor_id, status);

-- ---- Lotes de pago manual (para el historial y el recibo del referido) ----
create table if not exists public.academy_referral_payouts (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null,
  referrer_id uuid not null,
  total_cents int  not null default 0,
  currency    text not null default 'usd',
  method      text,                              -- paypal | zelle | bank | cash | other
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists academy_payout_mentor   on public.academy_referral_payouts(mentor_id);
create index if not exists academy_payout_referrer on public.academy_referral_payouts(referrer_id);

-- ---- Método de cobro del referido (por academia) ----
create table if not exists public.academy_payout_methods (
  mentor_id   uuid not null,
  referrer_id uuid not null,
  method      text,                              -- paypal | zelle | bank | cash | other
  handle      text,                              -- correo / número / cuenta
  updated_at  timestamptz not null default now(),
  primary key (mentor_id, referrer_id)
);
