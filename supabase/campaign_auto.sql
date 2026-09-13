-- ============================================================
-- Campañas full-automáticas (IA): interruptor por campaña + historial de
-- envíos con métricas de apertura/clic. Idempotente.
-- ============================================================

-- 1) Interruptor "Automático (IA)" por campaña. La IA redacta y programa sola.
alter table if exists campaigns add column if not exists auto boolean not null default false;

-- Encender por defecto en las dos que deben ser full-automáticas.
update campaigns set auto = true where key in ('newsletter', 'promo_monthly');

-- 2) Historial de envíos automáticos (lo que la IA redactó y envió).
create table if not exists campaign_runs (
  id uuid primary key,
  campaign_key text,
  campaign_name text,
  subject_es text,
  body_es text,
  subject_en text,
  body_en text,
  recipients int not null default 0,
  ai boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists campaign_runs_key_idx on campaign_runs (campaign_key, created_at desc);

-- 3) Enlazar cada envío individual a su corrida, para agregar aperturas/clics.
alter table if exists campaign_sends add column if not exists run_id uuid;
create index if not exists campaign_sends_run_idx on campaign_sends (run_id);
