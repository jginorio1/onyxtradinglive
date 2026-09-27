-- Guía de configuración adaptativa: guarda, por cuenta, qué quiere hacer el
-- trader con ella (diario / guardian / copy / tradingview). Sirve para saber
-- qué pasos mostrarle. La finalización de cada paso se detecta en vivo.
alter table public.trading_accounts add column if not exists onboard jsonb not null default '{}'::jsonb;
