-- ============================================================
-- Balance real: gastos operacionales del trader (retos, VPS, software…).
-- Correr una vez en Supabase. Idempotente.
-- ============================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'other',   -- funding|vps|software|data|internet|journal|education|fees|other
  label text,                                -- texto libre si category='other'
  amount numeric not null default 0,
  currency text default 'USD',
  spent_on date not null default current_date,
  recurring boolean not null default false,  -- true = mensual (cuenta cada mes desde spent_on)
  note text,
  created_at timestamptz not null default now()
);
create index if not exists expenses_user_idx on public.expenses (user_id, spent_on desc);
alter table public.expenses enable row level security;

-- La sección "Balance real" se muestra a los planes con la capacidad "expenses".
-- Actívala en Admin → Planes/Módulos (Capacidades) para Pro, Elite y Black Onyx.
-- Ejemplo directo por SQL (opcional):
--   update public.plans set capabilities = coalesce(capabilities,'{}'::jsonb) || '{"expenses":true}'
--   where id in ('pro','elite','black');
