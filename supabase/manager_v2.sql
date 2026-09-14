-- ============================================
-- Onyx Manager · Fase 2 (mi plan de trading, límites, noticias, disciplina)
-- Ejecuta este archivo completo en Supabase → SQL Editor.
-- Es seguro repetirlo: todo va con "if not exists".
-- ============================================

-- ------------------------------------------------------------
-- 1) Estado del día por cuenta
-- El EA manda su hora de servidor y aquí anclamos el día: con qué balance
-- empezó, cuántas operaciones lleva, si está bloqueado y hasta cuándo.
-- Es la fuente de la verdad; el EA solo obedece.
-- ------------------------------------------------------------
create table if not exists manager_state (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references trading_accounts(id) on delete cascade,

  day_key text,                 -- 'YYYY-MM-DD' del día del bróker ya corregido por reset_hour
  day_start_balance numeric,    -- balance al arrancar el día
  day_start_equity numeric,     -- equity al arrancar el día
  initial_balance numeric,      -- balance la primera vez que vimos la cuenta

  trades_today int not null default 0,
  losses_streak int not null default 0,      -- pérdidas seguidas (para el freno de tilt)
  last_loss_at timestamptz,                  -- para el enfriamiento

  blocked boolean not null default false,
  blocked_reason text,                       -- schedule | daily_loss | total_loss | target | tilt | news | max_trades
  blocked_until timestamptz,                 -- null = hasta el próximo día

  override_until timestamptz,                -- si pidió saltarse la regla, hasta cuándo vale
  override_requested_at timestamptz,         -- cuándo lo pidió (la fricción cuenta desde aquí)

  updated_at timestamptz default now(),
  unique (account_id)
);

create index if not exists manager_state_user_idx on manager_state (user_id);

alter table manager_state enable row level security;
drop policy if exists "own manager_state" on manager_state;
create policy "own manager_state" on manager_state for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2) Eventos: añadimos los tipos de la fase 2
-- kind ya existente: breakeven | trailing | partial | close_all | blocked | info
-- nuevos:            override  | limit    | news    | schedule  | tilt
-- (kind es texto, no hace falta migrar nada; esto es solo documentación)
-- ------------------------------------------------------------
alter table manager_events add column if not exists meta jsonb default '{}'::jsonb;
create index if not exists manager_events_kind_idx on manager_events (user_id, kind, created_at desc);

-- ------------------------------------------------------------
-- 3) Plantillas de prop firm editables desde el panel de admin
-- Se guardan en app_settings para que puedas corregirlas sin tocar código
-- cuando una firma cambie sus reglas.
-- ------------------------------------------------------------
insert into app_settings (key, value)
values ('prop_templates', '{"list": []}'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 4) La cuenta guarda qué plantilla aplicó, para poder avisarla si cambia
-- ------------------------------------------------------------
alter table trading_accounts add column if not exists firm_template text;

-- ------------------------------------------------------------
-- 5) Capacidad nueva: el bloqueo por noticias es del plan Elite
-- ------------------------------------------------------------
update plans set capabilities = capabilities || '{"manager_news": true}'::jsonb  where id = 'elite';
update plans set capabilities = capabilities || '{"manager_news": false}'::jsonb where id in ('free', 'pro');

notify pgrst, 'reload schema';
