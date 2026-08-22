-- ============================================================
-- "Invita y gana": programa de referidos para el USUARIO COMÚN (self-serve,
-- recompensa en crédito de cuenta). Convive con Embajadores (que es en efectivo
-- y aprobado). Idempotente.
-- ============================================================

-- Cada usuario tiene su propio código de referido y a quién lo trajo (miembro).
alter table if exists profiles add column if not exists ref_code      text;
alter table if exists profiles add column if not exists member_ref_by uuid;   -- id del usuario que lo invitó
create unique index if not exists profiles_ref_code_uidx on profiles (ref_code) where ref_code is not null;

-- Recompensas de referido (una fila por beneficiario). El crédito se aplica al
-- customer de Stripe pasada la ventana anti-abuso; se anula si hay reembolso.
create table if not exists member_rewards (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null,           -- quien invita
  referred_id  uuid not null,           -- el amigo que pagó
  beneficiary  uuid not null,           -- a quién se le acredita (referrer o referred)
  kind         text not null,           -- 'referrer' | 'friend'
  invoice_id   text,                    -- factura que disparó la recompensa
  amount       numeric not null,        -- crédito en la moneda base
  currency     text not null default 'USD',
  status       text not null default 'pending',   -- pending | applied | reversed
  available_at timestamptz not null default now(),
  applied_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists member_rewards_benef_idx on member_rewards (beneficiary, status);
create index if not exists member_rewards_due_idx   on member_rewards (status, available_at);
-- Un referido solo genera recompensa una vez (su primer pago).
create unique index if not exists member_rewards_once_uidx on member_rewards (referred_id, kind);
