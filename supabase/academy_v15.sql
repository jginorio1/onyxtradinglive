-- ============================================================
-- Onyx Academy · v15 — Preferencias de notificaciones push del alumno.
-- Idempotente. Correr DESPUÉS de academy_v14.sql.
-- ============================================================

-- Qué push quiere recibir cada usuario en la academia. Clave ausente = activa.
-- { announcements:bool, messages:bool, classes:bool, wins:bool }
alter table profiles add column if not exists academy_push_prefs jsonb not null default '{}'::jsonb;
