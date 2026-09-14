-- ============================================================
-- Onyx Bot Factory · v11 — Validación fina consciente de la resolución.
-- La BÚSQUEDA corre en la temporalidad de trabajo (la que eliges en «Search
-- resolution»); el VEREDICTO se toma sobre los datos más finos guardados
-- (M1 hoy, ticks reales cuando los subas). Guardamos con qué resolución se
-- validó y cuánto se degradó el score de la búsqueda al dato fino
-- (divergencia): baja = robusto de verdad; alta = sobreajuste a la TF de búsqueda.
-- Idempotente: se puede correr varias veces sin romper.
-- ============================================================
alter table public.factory_bots add column if not exists fine_tf         text;    -- 'M1' | 'M5' | ... | 'ticks'
alter table public.factory_bots add column if not exists fine_divergence numeric; -- puntos que cae el Onyx Score búsqueda→fino (0 = idéntico)
