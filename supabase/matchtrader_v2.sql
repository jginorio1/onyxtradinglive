-- ============================================================
-- MatchTrader v2 · integración REAL de la Broker API (ejecución + Guardian + Copy).
-- Añade lo que la API del bróker EXIGE para operar:
--   · login          → el nº de cuenta de trading (todos los endpoints de Trading lo piden)
--   · role           → si la cuenta es máster (emite), esclava (recibe) o ambas en Copy
--   · master_snapshot→ última foto de posiciones (para calcular abiertas/cerradas entre syncs)
--   · label          → apodo opcional para el trader
-- Idempotente: se puede correr varias veces.
-- ============================================================
alter table public.matchtrader_connections add column if not exists login text;
alter table public.matchtrader_connections add column if not exists role text not null default 'both';   -- master | slave | both
alter table public.matchtrader_connections add column if not exists master_snapshot jsonb;
alter table public.matchtrader_connections add column if not exists label text;

-- Índice para el cron (solo activas) y para buscar la máster de un usuario.
create index if not exists mtr_conn_enabled on public.matchtrader_connections(enabled) where enabled;

-- Copy por API (sin EA): la esclava MatchTrader ejecuta los comandos de la MISMA
-- cola copy_commands. Guardamos el ticket que devolvió el bróker al abrir, para
-- poder cerrar/modificar esa MISMA posición cuando llegue el comando de cierre.
alter table public.copy_commands add column if not exists slave_ticket text;
