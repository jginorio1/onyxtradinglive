-- ============================================================
-- Onyx · Diario v2: documentación de operaciones más rica y adaptable
-- Ejecuta en Supabase → SQL Editor. Seguro de re-ejecutar.
--
-- Añade al diario por operación:
--   grade        → calidad del trade (A / B / C)
--   plan_followed→ ¿seguiste tu plan? (yes / partial / no)
--   market_tags  → condición de mercado (tendencia, rango, noticia…)
--   error_tags   → qué falló (entré tarde, moví el SL…)
-- Y guarda los TAGS PROPIOS de cada trader en profiles.journal_tags
-- (los que añade con "+ Añadir"), para que el panel se adapte a su estilo.
-- ============================================================

alter table trade_journal add column if not exists grade         text;      -- 'A' | 'B' | 'C' | null
alter table trade_journal add column if not exists plan_followed text;      -- 'yes' | 'partial' | 'no' | null
alter table trade_journal add column if not exists market_tags   text[] not null default '{}';
alter table trade_journal add column if not exists error_tags    text[] not null default '{}';

-- Tags personalizados del trader (los que crea él). Estructura:
--   { "setups": [...], "emotions": [...], "markets": [...], "errors": [...] }
-- En la UI se combinan con los tags por defecto; aquí solo viven los suyos.
alter table profiles add column if not exists journal_tags jsonb not null default '{}'::jsonb;
