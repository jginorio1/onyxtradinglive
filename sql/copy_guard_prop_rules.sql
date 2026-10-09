-- ============================================================
-- Guardián de reglas de prop firm · copia entre cuentas (#1, sub-fase 2)
-- Añade por copia (copy_links) el interruptor del Guardián. APAGADO por
-- defecto: no cambia ningún comportamiento hasta que el trader lo active.
--   guard_prop_rules → si la esclava rompe su límite de prop firm, NO se
--                      abren copias nuevas (los cierres sí, para gestionar).
--   guard_strict     → pausa también al ACERCARSE al límite (watch), no solo
--                      al romperlo (breach).
-- Idempotente: se puede correr varias veces.
-- ============================================================
alter table if exists copy_links
  add column if not exists guard_prop_rules boolean not null default false,
  add column if not exists guard_strict     boolean not null default false;
