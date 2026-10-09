-- ============================================================
-- Fase B · #4 Suite anti-detección (copia entre cuentas)
-- Amplía el "retraso aleatorio" (jitter) que ya existe con dos variaciones más,
-- por copia, para que el patrón de la esclava NO sea idéntico al de la master
-- (las prop firms penalizan la copia detectable). Ambas APAGADAS por defecto
-- (0 = sin variación), así no cambian nada hasta que el trader las activa.
--   lot_jitter_pct   → varía el tamaño del lote ±X % al azar en cada apertura.
--   sltp_jitter_pts  → mueve el SL y el TP ±N puntos al azar en cada apertura.
-- Idempotente.
-- ============================================================
alter table if exists copy_links
  add column if not exists lot_jitter_pct  numeric not null default 0,
  add column if not exists sltp_jitter_pts numeric not null default 0;
