-- ============================================================
-- Retención anti-abuso: registro de descuentos concedidos + bloqueo.
-- Cierra el bucle de "cancelar cada 3 meses para farmear el 40%".
-- Idempotente.
-- ============================================================

-- Cada descuento de rescate concedido queda registrado (para cooldown, tope de
-- veces por usuario y tope global mensual).
create table if not exists retention_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  email       text,
  tier        int  not null default 1,   -- 1 = primera vez, 2 = repetida, …
  percent     int  not null,
  months      int  not null,
  created_at  timestamptz not null default now()
);
create index if not exists retention_grants_user_idx on retention_grants (user_id, created_at);
create index if not exists retention_grants_month_idx on retention_grants (created_at);

-- Si alguien toma el descuento y cancela dentro de la ventana, queda inelegible.
alter table if exists profiles add column if not exists retention_blocked boolean default false;
