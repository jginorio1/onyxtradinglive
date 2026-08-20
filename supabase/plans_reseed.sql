-- =====================================================================
--  Onyx Trading Live · Re-seed de PLANES
--  Úsalo si la página de precios sale VACÍA (la tabla `plans` no tiene
--  filas activas). Pégalo en Supabase → SQL Editor → Run.
--
--  · Crea los 3 planes base si no existen.
--  · Si ya existen, NO pisa tus precios/textos: solo se asegura de que
--    queden ACTIVOS (active = true) para que se vean en /pricing.
--  · Al final reactiva cualquier plan que estuviera desactivado.
-- =====================================================================

insert into plans (id, name, name_en, price_month, price_year, max_accounts, features, features_en, badge, badge_en, active, sort)
values
  ('free',  'Free',  'Free',  0,   0,   1,
    '["1 cuenta conectada","Estadísticas básicas","30 días de historial"]',
    '["1 connected account","Basic stats","30 days of history"]',
    null, null, true, 0),
  ('pro',   'Pro',   'Pro',   19,  190, 5,
    '["5 cuentas conectadas","Todas las estadísticas","Historial ilimitado","Calendario y gráficas","Reglas de fondeo"]',
    '["5 connected accounts","All stats","Unlimited history","Calendar & charts","Prop-firm rules"]',
    'Más popular', 'Most popular', true, 1),
  ('elite', 'Elite', 'Elite', 39,  390, 999,
    '["Cuentas ilimitadas","Todo lo de Pro","Informes automáticos","Alertas por Telegram","Soporte prioritario"]',
    '["Unlimited accounts","Everything in Pro","Automatic reports","Telegram alerts","Priority support"]',
    null, null, true, 2)
on conflict (id) do update
  set active = true;   -- si ya existe, solo lo reactiva (no toca tus precios/textos)

-- Por si acaso, reactiva TODOS los planes que estuvieran ocultos:
update plans set active = true where active is distinct from true;

-- Comprueba el resultado:
select id, name, price_month, price_year, active, sort from plans order by sort;
