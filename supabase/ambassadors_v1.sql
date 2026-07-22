-- ============================================
-- Onyx Trading Live · Programa de embajadores
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Ajustes globales del programa (editables desde el panel admin)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

insert into app_settings (key, value) values ('ambassadors', '{
  "enabled": true,
  "base_rate": 20,
  "tier_rate": 30,
  "tier_threshold": 10,
  "hold_days": 30,
  "min_payout": 50,
  "coupon_percent": 20,
  "coupon_months": 1
}'::jsonb) on conflict (key) do nothing;

-- Embajadores
create table if not exists ambassadors (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,                    -- lo que va en ?ref=
  status text not null default 'pending',       -- pending | approved | rejected | paused
  rate numeric,                                 -- si se rellena, manda sobre los niveles
  audience text,                                -- dónde tiene comunidad
  followers int,
  payout_method text,                           -- paypal | usdt | credit
  payout_details text,                          -- correo de PayPal o billetera
  promo_code_id text,                           -- id del código promocional en Stripe
  note text,                                    -- notas internas del admin
  created_at timestamptz default now(),
  approved_at timestamptz,
  unique (user_id)
);

-- Usuarios traídos por un embajador (atribución de por vida)
create table if not exists referrals (
  id uuid primary key default uuid_generate_v4(),
  ambassador_id uuid not null references ambassadors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text default 'link',                   -- link | coupon
  created_at timestamptz default now(),
  first_paid_at timestamptz,
  unique (user_id)                              -- un usuario pertenece a un solo embajador
);

-- Comisiones generadas en cada cobro
create table if not exists commissions (
  id uuid primary key default uuid_generate_v4(),
  ambassador_id uuid not null references ambassadors(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  invoice_id text unique,                       -- evita duplicados si Stripe reintenta
  base_amount numeric not null default 0,       -- lo que pagó el cliente
  rate numeric not null default 0,
  amount numeric not null default 0,            -- comisión
  currency text default 'USD',
  status text not null default 'pending',       -- pending | available | paid | reversed
  available_at timestamptz,                     -- cuándo deja de estar retenida
  payout_id uuid,
  created_at timestamptz default now()
);

-- Solicitudes de pago de embajadores (ojo: 'payouts' ya existe para retiros de fondeo)
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

-- Clics en el enlace (para medir conversión)
create table if not exists ref_clicks (
  id bigserial primary key,
  code text not null,
  created_at timestamptz default now()
);

-- A qué embajador pertenece cada usuario
alter table profiles add column if not exists referred_by uuid references ambassadors(id) on delete set null;

create index if not exists commissions_amb_idx on commissions (ambassador_id, status);
create index if not exists referrals_amb_idx on referrals (ambassador_id);
create index if not exists ref_clicks_code_idx on ref_clicks (code, created_at);

notify pgrst, 'reload schema';
