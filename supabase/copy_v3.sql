-- ============================================================
-- Copy v3 · envelope de riesgo completo por enlace (todo ON por defecto).
-- El trader apaga lo que no quiere (0 = off). require_sl es booleano.
-- ============================================================
alter table if exists public.copy_links
  add column if not exists max_deviation_pts  numeric  not null default 20,   -- desvío máx de entrada (pts). 0 = off
  add column if not exists max_signal_age_s   numeric  not null default 30,   -- antigüedad máx de la señal (s). 0 = off
  add column if not exists require_sl          boolean  not null default true, -- exigir Stop Loss para copiar
  add column if not exists max_positions       integer  not null default 20,   -- máx posiciones abiertas por copia. 0 = off
  add column if not exists per_symbol_lot_cap  numeric  not null default 0;    -- tope de lote acumulado por símbolo. 0 = usa max_lot

-- Nuevos enlaces nacen con protección encendida (sensata):
alter table if exists public.copy_links alter column daily_loss_pct   set default 5;
alter table if exists public.copy_links alter column max_drawdown_pct set default 10;
alter table if exists public.copy_links alter column max_spread       set default 30;
