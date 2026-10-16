-- ============================================================
-- MOTOR ÚNICO DE COMISIONES (Fase 1 · Fundación)
-- Un solo "libro" para TODO el dinero que la plataforma debe a quien refiere:
-- Vendedores, Embajadores, afiliados de Academia e "Invita y gana" de miembros.
-- Cada programa conserva SUS tablas de dominio (niveles, permisos, reglas, UI);
-- aquí vive solo la plomería del dinero: acreditar, madurar, revertir, saldos, pagar.
-- El acreditado es idempotente por (program, invoice_id, referrer_id, level).
--   program:     'sales' | 'ambassador' | 'academy' | 'member'
--   referrer_id: id del que gana EN la tabla de su programa (sales_reps.id, etc.)
--   level:       'direct' | 'override1' | 'override2' | 'bonus' | ... (libre por programa)
--   status:      'pending' -> (madura por available_at) -> 'available' -> 'paid' | 'reversed'
-- ============================================================

create table if not exists comm_commissions (
  id                  uuid primary key default gen_random_uuid(),
  program             text not null,
  referrer_id         uuid not null,                 -- id en la tabla del programa
  beneficiary_user_id uuid,                           -- auth user del que gana (para payout)
  client_user_id      uuid,                           -- quién pagó (puede ser null en bonos)
  level               text not null default 'direct',
  invoice_id          text not null,                  -- factura/origen (idempotencia)
  base_amount         numeric not null default 0,
  pct                 numeric not null default 0,
  amount              numeric not null default 0,
  currency            text not null default 'USD',
  line                text,                            -- subscriptions|addons|guardian|academy|botlab|copy
  status              text not null default 'pending', -- pending|available|paid|reversed
  available_at        timestamptz,                     -- cuándo deja de estar retenida
  paid_at             timestamptz,
  reversed_at         timestamptz,                     -- cuándo se revirtió (clawback)
  payout_id           uuid,                            -- a qué pago pertenece (si ya se pagó)
  meta                jsonb,
  created_at          timestamptz not null default now()
);

-- Idempotencia del acreditado y consultas de saldo rápidas por rep.
create unique index if not exists comm_commissions_uniq
  on comm_commissions (program, invoice_id, referrer_id, level);
create index if not exists comm_commissions_rep_idx
  on comm_commissions (program, referrer_id, status);
create index if not exists comm_commissions_client_idx
  on comm_commissions (program, client_user_id, level);
create index if not exists comm_commissions_invoice_idx
  on comm_commissions (program, invoice_id);

-- Registro de pagos a referidores (un pago agrupa varias comisiones).
create table if not exists comm_payouts (
  id                  uuid primary key default gen_random_uuid(),
  program             text not null,
  referrer_id         uuid not null,
  beneficiary_user_id uuid,
  amount              numeric not null default 0,
  currency            text not null default 'USD',
  method              text,                            -- stripe | usdt | manual | credit
  ref                 text,                            -- id de transferencia / nota
  status              text not null default 'paid',    -- paid | pending | failed
  created_by          uuid,
  created_at          timestamptz not null default now()
);
create index if not exists comm_payouts_rep_idx on comm_payouts (program, referrer_id, created_at desc);

-- Servicio (supabaseAdmin) es quien escribe; no exponemos por RLS al cliente.
alter table comm_commissions enable row level security;
alter table comm_payouts     enable row level security;

notify pgrst, 'reload schema';
