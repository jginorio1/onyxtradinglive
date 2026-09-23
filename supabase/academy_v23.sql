-- ============================================================
-- Onyx Academy · v23 · Facturación robusta de comisiones
-- Arregla tres cosas del libro de comisiones (onyx_commissions):
--  1) Idempotencia: cada comisión se ata a una referencia única de Stripe
--     (factura o payment_intent), así un reintento de webhook NO duplica.
--  2) Renovaciones: al registrar por factura, las comisiones mensuales se anotan.
--  3) Reembolsos: una comisión se puede marcar 'reversed' sin borrarla.
-- Idempotente.
-- ============================================================
alter table public.onyx_commissions add column if not exists status      text not null default 'earned'; -- earned | reversed
alter table public.onyx_commissions add column if not exists stripe_ref  text;   -- invoice id o payment_intent
alter table public.onyx_commissions add column if not exists reversed_at timestamptz;

-- Backfill: las filas existentes cuentan como ganadas.
update public.onyx_commissions set status = 'earned' where status is null;

-- Una comisión por referencia de Stripe y mentor (evita doble conteo en reintentos).
create unique index if not exists onyx_commissions_ref on public.onyx_commissions(mentor_id, stripe_ref) where stripe_ref is not null;
