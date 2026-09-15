-- ============================================================
-- Copy v4 · Retraso aleatorio anti-patrón (jitter).
-- Añade un retraso al azar (0…N s) antes de copiar CADA apertura, para que el
-- timing de la esclava no sea idéntico al de la master. Reduce el riesgo de que
-- una prop firm detecte copia por patrón de tiempo. Los cierres salen al instante.
--
-- Implementación 100% en la nube: no hace falta recompilar el EA.
--   · copy_links.jitter_max_s → máximo del retraso (0 = apagado).
--   · copy_commands.execute_after → hora a partir de la cual la esclava recibe el
--     comando; el endpoint /api/v1/copy/slave solo entrega los ya "maduros".
-- ============================================================

alter table if exists public.copy_links
  add column if not exists jitter_max_s integer not null default 0;

alter table if exists public.copy_commands
  add column if not exists execute_after timestamptz;

-- Índice para que el filtro "comandos maduros" del slave sea rápido.
create index if not exists idx_copy_commands_slave_due
  on public.copy_commands (slave_account_id, status, execute_after);
