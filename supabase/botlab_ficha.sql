-- ============================================================
-- Onyx Bot Lab · Ficha técnica del robot
-- Campos DECLARADOS por el vendedor (estilo, timeframe, mercado, filtro de
-- noticias, Stop Loss, riesgo). Onyx los contrasta con las operaciones reales
-- (duración, frecuencia, martingala, SL) que viven en el jsonb `perf`.
-- ============================================================

alter table if exists bot_products add column if not exists spec_style     text;    -- tendencia | ruptura | scalping | intradia | swing | rango
alter table if exists bot_products add column if not exists spec_timeframe text;    -- ej. H1 · H4
alter table if exists bot_products add column if not exists spec_market    text;    -- forex | oro | indices | cripto | otro
alter table if exists bot_products add column if not exists spec_news      boolean; -- ¿tiene filtro de noticias? (informativo, decide el comprador)
alter table if exists bot_products add column if not exists spec_sl        boolean; -- ¿usa Stop Loss? (obligatorio)
alter table if exists bot_products add column if not exists spec_risk      text;    -- ej. "1% por operación"
