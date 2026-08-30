-- ============================================================
-- Onyx · Plan "Trader" (bot-only) para el landing del Constructor (/bot-builder)
-- Ejecuta en Supabase → SQL Editor. Seguro de re-ejecutar.
--
-- Idea: el que solo quiere BOTS no necesita Onyx Guardian ni el filtro de
-- noticias como servicio aparte — el bot ya trae todo eso dentro. Solo necesita
-- construir bots y REGISTRAR operaciones. Por eso este plan:
--   • Activa el módulo de robots (algo) + diario/métricas/portafolio.
--   • NO activa el Guardian (manager:false) → no se le cobra lo que no usa.
--   • max_accounts = 3 (escala con add-ons de cuenta extra).
--
-- El PRECIO ($15/$150) es un valor de arranque: ajústalo en Admin → Planes,
-- y pon ahí el Price ID de Stripe (mensual/anual) para cobrar de verdad.
-- ============================================================

insert into plans (id, name, name_en, price_month, price_year, max_accounts,
                   features, features_en, badge, badge_en, capabilities, active, sort)
values (
  'trader', 'Trader', 'Trader', 15, 150, 3,
  '["Bots ilimitados","Hasta 3 cuentas","Registro automático de operaciones","Diario, métricas y portafolio","Filtro de noticias y sesión (dentro del bot)","Multi-broker: MT4 · MT5 · cTrader"]'::jsonb,
  '["Unlimited bots","Up to 3 accounts","Automatic trade logging","Journal, metrics and portfolio","News and session filter (inside the bot)","Multi-broker: MT4 · MT5 · cTrader"]'::jsonb,
  null, null,
  '{"journal":true,"compare":true,"funding":true,"costs":true,"export":true,"reports":false,"telegram":true,"manager":false,"algo":true,"copy":false,"history_days":0}'::jsonb,
  true, 1
)
on conflict (id) do nothing;

-- Descripción corta bilingüe.
update plans set
  desc_es = coalesce(nullif(desc_es, ''), 'Todo para tus robots'),
  desc_en = coalesce(nullif(desc_en, ''), 'Everything for your bots')
where id = 'trader';

-- Deja los demás planes por encima de Trader en el orden del listado
-- (Trader = 1). Solo sube el orden de los que hoy estén en 1 o menos.
update plans set sort = sort + 1 where id in ('pro','elite','black') and sort <= 1;

notify pgrst, 'reload schema';
