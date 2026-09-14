-- Preferencia del trader para recibir su reporte de rendimiento por Telegram.
-- Valores: 'off' (por defecto), 'weekly' (cada lunes), 'monthly' (día 1).
alter table if exists public.profiles
  add column if not exists tg_report text not null default 'off';
