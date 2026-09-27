-- ============================================
-- Onyx Trading Live · Retención y complementos
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Cada intento de cancelación, con su motivo y en qué acabó
create table if not exists cancellations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  plan text,
  reason text,                 -- price | unused | missing | stopped | other
  detail text,                 -- lo que escriba el usuario
  outcome text not null default 'pending',  -- pending | saved_discount | saved_pause | saved_downgrade | canceled
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists cancellations_created_idx on cancellations (created_at desc);

-- Cuentas MT extra compradas como complemento
alter table profiles add column if not exists extra_accounts int not null default 0;

-- Reglas de retención (editables desde el panel)
insert into app_settings (key, value) values ('retention', '{
  "enabled": true,
  "discount_percent": 50,
  "discount_months": 3,
  "pause_months": 2,
  "allow_downgrade": true
}'::jsonb) on conflict (key) do nothing;

-- Complementos de pago
insert into app_settings (key, value) values ('addons', '{
  "extra_account_enabled": true,
  "extra_account_price": 4,
  "extra_account_price_id": ""
}'::jsonb) on conflict (key) do nothing;

notify pgrst, 'reload schema';
