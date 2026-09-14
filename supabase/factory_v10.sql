-- Onyx Bot Factory · v10 — validación fina en M1 (tick-accurate) del robot.
-- Opcional: guarda el resultado de re-backtestear el robot sobre las barras M1
-- completas. Si no lo corres, la validación igual funciona (solo no se persiste).
alter table public.factory_bots add column if not exists fine_score int;    -- Onyx Score en M1 (0-100)
alter table public.factory_bots add column if not exists fine_grade text;   -- A/B/C/D/F en M1
alter table public.factory_bots add column if not exists fine_bars  bigint; -- nº de barras M1 usadas
alter table public.factory_bots add column if not exists fine_at    timestamptz;
notify pgrst, 'reload schema';
