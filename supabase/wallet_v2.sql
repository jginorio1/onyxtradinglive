-- ============================================================
-- MONEDERO v2 · AUTO-RECARGA (recarga sola cuando el saldo baja de un umbral)
-- Guarda la preferencia por usuario y la referencia de su tarjeta en Stripe
-- (nunca el número: solo el id del método de pago y del cliente). Topes diarios
-- para evitar cobros en bucle. Web/Android (en iPhone no se ofrece · regla Apple).
-- ============================================================

create table if not exists wallet_autoreload (
  user_id          uuid primary key,
  enabled          boolean not null default false,
  threshold_cents  bigint not null default 1000,   -- recarga cuando el saldo baja de esto
  amount_cents     bigint not null default 2500,   -- cuánto recarga cada vez
  stripe_customer  text,                            -- cliente Stripe (para cobrar off-session)
  stripe_pm        text,                            -- método de pago guardado (tarjeta)
  max_per_day      int not null default 3,          -- tope de recargas automáticas por día
  day_date         date,
  day_count        int not null default 0,
  updated_at       timestamptz not null default now()
);

alter table wallet_autoreload enable row level security;  -- solo el servicio

notify pgrst, 'reload schema';
