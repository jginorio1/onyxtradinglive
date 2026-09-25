-- Historial mensual del scorecard de cada vendedor.
-- Se va llenando solo: cada vez que el vendedor abre su panel se guarda/actualiza
-- la foto del mes en curso (puntaje + tier + el desglose por factor). Así el
-- vendedor puede ver cómo va este mes y compararse con los meses anteriores.
create table if not exists public.sales_score_history (
  id          uuid primary key default gen_random_uuid(),
  rep_id      uuid not null references public.sales_reps(id) on delete cascade,
  period      text not null,                    -- 'YYYY-MM'
  score       int  not null default 0,          -- 0-100 compuesto
  tier        text not null default 'solid',    -- star | solid | risk
  parts       jsonb not null default '{}'::jsonb,-- { rating, conversion, activity, service, retention }
  updated_at  timestamptz not null default now(),
  unique (rep_id, period)
);
create index if not exists idx_score_hist_rep on public.sales_score_history(rep_id, period desc);
alter table public.sales_score_history enable row level security;
-- Sin políticas: solo el service role (backend) lee/escribe. El vendedor lo ve a
-- través del API del panel, nunca directo.
