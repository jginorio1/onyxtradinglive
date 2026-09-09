-- ============================================
-- Onyx Trading Live · Perfil del trader (onboarding)
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Datos del perfil de trader que se piden una vez, tras confirmar el email.
alter table profiles add column if not exists country     text;
alter table profiles add column if not exists experience  text;   -- novato | intermedio | avanzado | pro
alter table profiles add column if not exists trade_style text;   -- scalping | day | swing | position
alter table profiles add column if not exists platform    text;   -- mt4 | mt5 | ambas
alter table profiles add column if not exists prop_firm    text;   -- nombre de la prop firm, o 'ninguna'
alter table profiles add column if not exists goal        text;   -- pasar_challenge | consistencia | crecer | vivir

-- Marca de que el usuario ya vio el onboarding (aunque lo haya saltado).
-- Si es null, se le muestra la pantalla una vez.
alter table profiles add column if not exists onboarded_at timestamptz;

notify pgrst, 'reload schema';
