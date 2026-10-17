-- ============================================================
-- MONEDERO DEL USUARIO (saldo recargable · solo-crédito, no retirable)
-- Un libro de movimientos: cada recarga, gasto, reembolso o ajuste es una fila
-- con monto firmado en CENTAVOS (positivo = entra, negativo = sale). El saldo
-- es la SUMA de las filas del usuario. Idempotente por (source, ext_ref): una
-- misma recarga/gasto NO se registra dos veces aunque se reintente el webhook.
-- ============================================================

create table if not exists wallet_ledger (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  amount_cents bigint not null,                 -- + entra / - sale
  kind         text not null,                   -- topup | spend | refund | reversal | adjust
  method       text,                            -- card | usdt | system
  source       text,                            -- stripe | usdt | remote_support | admin | ...
  ext_ref      text,                            -- id de Stripe / crypto / factura (idempotencia)
  note         text,
  meta         jsonb,
  created_at   timestamptz not null default now()
);

-- Idempotencia: no acreditar/gastar dos veces el mismo origen.
create unique index if not exists wallet_ledger_idem
  on wallet_ledger (source, ext_ref) where ext_ref is not null;
-- Saldo e historial rápidos por usuario.
create index if not exists wallet_ledger_user_idx
  on wallet_ledger (user_id, created_at desc);

alter table wallet_ledger enable row level security;  -- solo el servicio escribe/lee

notify pgrst, 'reload schema';
