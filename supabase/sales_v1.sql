-- ============================================
-- Onyx Trading Live · Red de VENTAS (vendedores + supervisores, 3 niveles)
-- Comisión recurrente por pago mensual. Reutiliza el esquema de seguridad de
-- embajadores (maduración, reversa por reembolso, frenos, Stripe Connect).
-- Ejecuta este archivo completo en Supabase → SQL Editor.
-- ============================================

-- Ajustes globales del programa (editables desde el panel admin).
insert into app_settings (key, value) values ('sales', '{
  "enabled": true,
  "direct_rate": 20,
  "override1_rate": 7,
  "override2_rate": 4,
  "commission_months": 0,
  "hold_days": 30,
  "min_payout": 50,
  "trial_max_days": 14,
  "discount_max_pct": 20,
  "auto_payout": true,
  "review_before_pay": false,
  "allow_recruit": true
}'::jsonb) on conflict (key) do nothing;

-- Representantes de venta (árbol jerárquico hasta 3 niveles).
--   level: 'vendedor' | 'l1' (supervisor N1) | 'l2' (supervisor N2)
--   parent_id: su superior directo en el árbol (null en el tope).
create table if not exists sales_reps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null default 'vendedor',        -- vendedor | l1 | l2
  parent_id uuid references sales_reps(id) on delete set null,
  code text not null unique,                      -- lo que va en ?sv=
  status text not null default 'active',          -- active | paused | removed
  rate_override numeric,                          -- si se rellena, manda sobre el % del nivel
  display_name text,                              -- nombre visible del vendedor
  note text,                                      -- notas internas del admin
  stripe_account_id text,                         -- cuenta Connect (nodo compartido)
  payouts_enabled boolean not null default false,
  on_hold boolean not null default false,         -- freno individual: acumula pero no paga
  created_at timestamptz default now(),
  approved_at timestamptz,
  unique (user_id)
);

-- Clientes atribuidos a un vendedor (atribución de por vida).
--   source: 'link' | 'invite' | 'manual'
create table if not exists sales_clients (
  id uuid primary key default uuid_generate_v4(),
  rep_id uuid not null references sales_reps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text default 'link',
  note text,
  created_at timestamptz default now(),
  first_paid_at timestamptz,
  unique (user_id)                                -- un cliente pertenece a un solo vendedor
);

-- Comisiones generadas en cada cobro mensual. Una fila por nivel beneficiado.
--   level: 'direct' (el vendedor) | 'override1' (su N1) | 'override2' (el N2)
create table if not exists sales_commissions (
  id uuid primary key default uuid_generate_v4(),
  rep_id uuid not null references sales_reps(id) on delete cascade,
  client_user_id uuid references auth.users(id) on delete set null,
  level text not null default 'direct',
  invoice_id text,                                -- id de la factura de Stripe
  base_amount numeric not null default 0,         -- lo que pagó el cliente
  pct numeric not null default 0,
  amount numeric not null default 0,              -- comisión de esta fila
  currency text default 'USD',
  status text not null default 'pending',         -- pending | available | paid | reversed
  available_at timestamptz,                       -- cuándo deja de estar retenida
  payout_id uuid,
  created_at timestamptz default now(),
  paid_at timestamptz,
  unique (invoice_id, rep_id, level)              -- evita duplicar si Stripe reintenta
);

-- Pagos a los representantes (Stripe Connect / cripto / manual).
create table if not exists sales_payouts (
  id uuid primary key default uuid_generate_v4(),
  rep_id uuid not null references sales_reps(id) on delete cascade,
  amount numeric not null,
  method text,                                    -- stripe | usdt | manual
  ref text,                                        -- txid / referencia
  status text not null default 'requested',       -- requested | paid | rejected
  note text,
  created_at timestamptz default now(),
  paid_at timestamptz
);

-- Registro de pruebas y descuentos que el vendedor concede (para topes + auditoría).
--   kind: 'trial' (value = días) | 'discount' (value = %)
create table if not exists sales_grants (
  id uuid primary key default uuid_generate_v4(),
  rep_id uuid not null references sales_reps(id) on delete cascade,
  client_user_id uuid references auth.users(id) on delete set null,
  kind text not null,
  value numeric not null default 0,
  code text,                                       -- cupón generado (si aplica)
  created_at timestamptz default now()
);

-- Clics en el enlace del vendedor (para medir conversión).
create table if not exists sales_clicks (
  id bigserial primary key,
  code text not null,
  created_at timestamptz default now()
);

-- A qué vendedor pertenece cada usuario (espejo rápido para el registro/atribución).
alter table profiles add column if not exists sales_rep_id uuid references sales_reps(id) on delete set null;

create index if not exists sales_reps_parent_idx on sales_reps (parent_id);
create index if not exists sales_reps_user_idx on sales_reps (user_id);
create index if not exists sales_clients_rep_idx on sales_clients (rep_id);
create index if not exists sales_comm_rep_idx on sales_commissions (rep_id, status);
create index if not exists sales_comm_invoice_idx on sales_commissions (invoice_id);
create index if not exists sales_grants_rep_idx on sales_grants (rep_id, kind, created_at);
create index if not exists sales_clicks_code_idx on sales_clicks (code, created_at);

-- Seguridad: solo el servidor (service role) toca estas tablas. RLS activo sin
-- políticas públicas = nadie más lee/escribe directamente.
alter table sales_reps enable row level security;
alter table sales_clients enable row level security;
alter table sales_commissions enable row level security;
alter table sales_payouts enable row level security;
alter table sales_grants enable row level security;
alter table sales_clicks enable row level security;

notify pgrst, 'reload schema';
