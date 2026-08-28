-- Desfase horario del trader respecto a UTC, en minutos (local = UTC + tz_offset_min).
-- Lo captura la app al entrar (getTimezoneOffset del navegador) para entregar el
-- reporte de Telegram a SU hora local. Negativo al oeste: UTC-3 = -180.
alter table if exists public.profiles
  add column if not exists tz_offset_min integer;
