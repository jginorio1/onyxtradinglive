-- =====================================================================
--  Onyx Trading Live · Plan dedicado a BOTS (Onyx Bots)
--  Crea un plan REAL y comprable, id = 'bots'. Aparece solo en el home
--  (junto a los demás) y en el landing de robots (marcado "Para bots").
--
--  Cómo usarlo:
--   1) Pega esto en Supabase → SQL Editor → Run.
--   2) Luego ajusta nombre, precio y textos desde Admin → Planes.
--   3) En Stripe, crea el precio recurrente y pega el Price ID en la
--      tarjeta del plan (campo "Stripe Price ID") desde Admin → Planes.
--
--  Notas:
--   · capabilities.algo = true  → desbloquea el módulo de robots (Mis robots
--     + constructor) para quien tenga este plan.
--   · sort = 1  → lo coloca justo después de Gratis (ajústalo a tu gusto).
--   · Si ya existe 'bots', NO pisa tus precios/textos: solo lo reactiva.
-- =====================================================================

insert into plans (id, name, name_en, desc_es, desc_en, price_month, price_year, max_accounts,
                   features, features_en, badge, badge_en, capabilities, active, sort)
values (
  'bots', 'Onyx Bots', 'Onyx Bots',
  'Automatiza: crea y conecta robots', 'Automate: build & connect robots',
  19, 190, 3,
  '["Robots ilimitados","Hasta 3 cuentas conectadas","MT4 · MT5 · cTrader","Gatillos, salidas, riesgo y frenos","Guía PDF personalizada + plantillas","Métricas avanzadas y laboratorio de portafolio"]',
  '["Unlimited robots","Up to 3 connected accounts","MT4 · MT5 · cTrader","Triggers, exits, risk & brakes","Personalized PDF guide + templates","Advanced metrics & portfolio lab"]',
  'Para bots', 'For bots',
  '{"algo": true}'::jsonb,
  true, 1
)
on conflict (id) do update
  set active = true,                                   -- reactiva si estaba oculto
      capabilities = plans.capabilities || '{"algo": true}'::jsonb;  -- garantiza el módulo de bots

-- Comprueba el resultado:
select id, name, price_month, price_year, sort, active, capabilities
from plans order by sort;
