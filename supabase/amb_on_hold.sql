-- Freno por embajador: si on_hold = true, el pago automático NO lo paga
-- (acumula saldo, pero tú decides cuándo). Reversible desde el panel.
alter table if exists public.ambassadors
  add column if not exists on_hold boolean not null default false;
