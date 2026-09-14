-- Zona horaria del trader: manejo mixto (auto + manual).
--   · timezone      → nombre IANA (ej. 'America/Puerto_Rico'). Default 'UTC'.
--   · tz_offset_min → desfase en minutos que capta el navegador (ver tz_offset.sql).
--   · tz_manual     → true cuando el TRADER eligió su zona a mano en el perfil.
-- Regla: si tz_manual = false, el sistema mantiene `timezone` sincronizada sola con
-- el navegador del trader (TzSync → /api/account/tz). Si el trader la elige en el
-- dropdown, se marca tz_manual = true y el sistema ya no la vuelve a tocar.
alter table if exists public.profiles
  add column if not exists tz_manual boolean not null default false;
