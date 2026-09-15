-- Historial de auditorías (para el calendario, el gráfico y los promedios).
-- Cada corrida de la auditoría (CI de GitHub) guarda una fila con sus notas.
-- Correr una vez en Supabase. Idempotente.
create table if not exists public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  url text,
  performance int, accessibility int, seo int, best_practices int,
  lcp numeric, inp numeric, cls numeric,
  ts_errors int default 0, vulnerabilities int default 0,
  sec_overall text, sec_fails int default 0, sec_warns int default 0
);
create index if not exists audit_runs_at on public.audit_runs (at desc);

-- RLS: el panel lee con rol de servicio; nadie con la clave pública.
alter table public.audit_runs enable row level security;
