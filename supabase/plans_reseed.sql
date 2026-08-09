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
    '["5 cuentas conectadas","Onyx Guardian: freno de riesgo","Historial ilimitado y reglas de fondeo","Diario, costes y exportar CSV","Crea tu academia (Onyx Academy)"]',
    '["5 connected accounts","Onyx Guardian: risk brake","Unlimited history & funding rules","Journal, costs & CSV export","Build your academy (Onyx Academy)"]',
    'Más popular', 'Most popular', true, 1),
  ('elite', 'Elite', 'Elite', 39,  390, 999,
    '["Cuentas ilimitadas","Copy trading (1 master · 5 esclavas)","Cierres parciales y bloqueo por noticias","Alertas e informe por Telegram","Soporte prioritario"]',
    '["Unlimited accounts","Copy trading (1 master · 5 slaves)","Partial closes & news blackout","Telegram alerts & report","Priority support"]',
    null, null, true, 2)
on conflict (id) do update
  set active = true;   -- si ya existe, solo lo reactiva (no toca tus precios/textos)

-- Por si acaso, reactiva TODOS los planes que estuvieran ocultos:
update plans set active = true where active is distinct from true;

-- Comprueba el resultado:
select id, name, price_month, price_year, active, sort from plans order by sort;
