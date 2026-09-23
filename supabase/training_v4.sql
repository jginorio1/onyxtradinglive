-- =====================================================================
-- Onyx Training · v4 — biblioteca central de materiales (reutilizable).
-- Sube un video/PDF una vez y reúsalo en cualquier lección. Idempotente.
-- =====================================================================
create table if not exists training_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'doc',   -- video | doc
  title text not null default '',
  url text not null,
  size bigint,
  created_at timestamptz not null default now()
);
create index if not exists training_assets_kind_idx on training_assets (kind, created_at desc);
alter table training_assets enable row level security;
