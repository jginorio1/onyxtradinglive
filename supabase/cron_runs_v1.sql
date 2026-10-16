-- ============================================================
-- LATIDOS DEL SISTEMA (heartbeats)
-- Una fila por proceso que queremos vigilar (ej. 'stripe_webhook'): cuándo fue
-- la última vez que corrió/recibió algo y con qué dato. Se muestra con fecha y
-- hora en Pagos → Revisión / integridad → Automatismos.
-- Upsert por name, sin carreras entre procesos distintos.
-- ============================================================

create table if not exists system_heartbeats (
  name     text primary key,
  last_at  timestamptz not null default now(),
  meta     jsonb,
  hits     bigint not null default 0
);

alter table system_heartbeats enable row level security;  -- solo el servicio escribe

notify pgrst, 'reload schema';
