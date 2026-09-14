-- Trackrecord público del trader: interruptor propio de cada usuario.
-- El ADMIN controla qué campos se muestran (guardado en app_settings, clave
-- 'trackrecord'); esto solo guarda si CADA trader tiene su página encendida.
alter table public.profiles add column if not exists public_track boolean default false;
