-- ============================================================
-- Auto-reclutamiento de embajadores: columnas de seguimiento en prospectos.
-- Idempotente.
-- ============================================================
alter table if exists ambassador_prospects add column if not exists contacted_at  timestamptz;
alter table if exists ambassador_prospects add column if not exists last_email_at timestamptz;
alter table if exists ambassador_prospects add column if not exists followups    integer not null default 0;
alter table if exists ambassador_prospects add column if not exists lang          text;

create index if not exists amb_prospects_followup_idx
  on ambassador_prospects (status, last_email_at);
