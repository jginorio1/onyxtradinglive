-- ============================================================
-- Evidencia de pagos para defender chargebacks / disputas de tarjeta.
-- Una fila por checkout (planes, Bot Lab, servicios, copy…). Guarda IP,
-- navegador, términos aceptados y el log de entrega/descarga. Desde aquí
-- armamos la evidencia que se envía a Stripe cuando hay una disputa.
-- NO guarda datos de tarjeta (eso vive solo en Stripe).
-- ============================================================
create table if not exists public.payment_evidence (
  id uuid primary key default gen_random_uuid(),
  session_id text unique,                 -- Stripe Checkout Session id
  payment_intent text,                    -- pi_… (se rellena al pagar)
  charge_id text,                         -- ch_… (se rellena al pagar)
  user_id uuid,
  email text,
  kind text,                              -- plan | botlab | service | copy | academy …
  product_id text,
  product_description text,
  amount_cents integer,
  currency text default 'usd',
  ip text,
  user_agent text,
  terms_version text,
  terms_accepted_at timestamptz,
  consent boolean default false,          -- aceptó explícitamente los términos
  delivery_at timestamptz,                -- primera entrega/descarga
  delivery_log jsonb default '[]'::jsonb, -- [{at, ip, ua, what}]
  status text default 'created',          -- created | paid | disputed | refunded
  dispute_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_pev_pi on public.payment_evidence(payment_intent);
create index if not exists idx_pev_charge on public.payment_evidence(charge_id);
create index if not exists idx_pev_user on public.payment_evidence(user_id);
create index if not exists idx_pev_status on public.payment_evidence(status);
