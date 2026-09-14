-- ============================================================
-- Onyx Bot Lab · Modelo A (robots del constructor)
-- El vendedor liga el producto a una receta suya del constructor (bots_built).
-- Al comprar, la entrega se GENERA al vuelo (candado incluido) para MT5, MT4 y
-- cTrader. El modo 'upload' (archivo externo) sigue disponible como respaldo.
-- ============================================================
alter table if exists bot_products add column if not exists source   text default 'upload';  -- 'build' = del constructor · 'upload' = archivo externo
alter table if exists bot_products add column if not exists build_id uuid;                    -- receta del constructor (bots_built.id) del vendedor

comment on column bot_products.source   is 'build = generado del constructor (candado 3 plataformas) · upload = archivo subido';
comment on column bot_products.build_id is 'bots_built.id de la receta del vendedor cuando source = build';
