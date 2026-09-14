-- ============================================================
-- Onyx Bot Lab · Ficha técnica ampliada del robot
-- Más datos para que el comprador sepa exactamente qué compra.
-- Onyx contrasta lo declarado contra las operaciones reales.
-- ============================================================
alter table if exists bot_products add column if not exists spec_capital   text;    -- capital mínimo recomendado (ej. "$500")
alter table if exists bot_products add column if not exists spec_direction text;    -- long | short | both
alter table if exists bot_products add column if not exists spec_symbols   text;    -- pares/símbolos (ej. "XAUUSD, EURUSD")
alter table if exists bot_products add column if not exists spec_maxdd     text;    -- drawdown máximo declarado (ej. "15%")
alter table if exists bot_products add column if not exists spec_propfirm  boolean; -- ¿apto para prop firm? (informativo)
alter table if exists bot_products add column if not exists spec_broker    text;    -- bróker/cuenta recomendada (ej. "ECN · spread bajo")
