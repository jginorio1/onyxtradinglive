-- ============================================================
-- Onyx Bot Lab · Semilla de robots oficiales de Onyx para el Marketplace.
-- Publica 6 robots reales (seller_id NULL = Onyx oficial, verificados y activos)
-- para que la tienda no se vea vacía y "Ver robot" lleve a un checkout de verdad.
-- Idempotente: borra los de estos nombres antes de reinsertar, así puedes
-- re-ejecutarlo sin duplicar. Corre esto en el MISMO entorno (prod o beta) que usa
-- el sitio, después de haber corrido botlab.sql y sus versiones.
-- ============================================================

delete from public.bot_products
 where is_official = true and seller_id is null
   and name in ('Trend Rider Pro','London Breakout','Gold Scalper X','Range Master','NY Momentum','Swing Keeper');

insert into public.bot_products
  (seller_id, name, tagline, description, kind, interval, price_cents, currency, platform, pair, category,
   perf, is_official, verified, status, accepts_card, accepts_crypto, sales, rating, reviews, position)
values
  (null, 'Trend Rider Pro', 'Seguidor de tendencia en índices, con gestión de riesgo dentro.',
   'Robot de tendencia para US100 con filtro de noticias y de sesión. Reglas de riesgo horneadas: límite de drawdown y stop diario. Compatible con MT5. Pruébalo en demo antes de pasarlo a real.',
   'subscription', 'month', 2900, 'usd', 'mt5', 'US100', 'trend',
   '{"score":92,"ret90":"+38%","dd":"3.1%","winrate":"61%"}'::jsonb, true, true, 'active', true, true, 214, 4.9, 63, 1),

  (null, 'London Breakout', 'Rompimiento de la apertura de Londres en GBPUSD.',
   'Aprovecha el rango previo a la apertura de Londres y opera el rompimiento con SL/TP fijos. Ideal para cuentas de fondeo. MT4.',
   'subscription', 'month', 1900, 'usd', 'mt4', 'GBPUSD', 'breakout',
   '{"score":88,"ret90":"+27%","dd":"4.2%","winrate":"57%"}'::jsonb, true, true, 'active', true, true, 168, 4.7, 41, 2),

  (null, 'Gold Scalper X', 'Scalping de oro en sesiones de alta volatilidad.',
   'Scalper de XAUUSD con filtro de spread y de horario. Riesgo controlado por operación. MT5. Recomendado probar en demo primero por su ritmo rápido.',
   'subscription', 'month', 3900, 'usd', 'mt5', 'XAUUSD', 'scalping',
   '{"score":85,"ret90":"+45%","dd":"6.0%","winrate":"54%"}'::jsonb, true, true, 'active', true, true, 132, 4.6, 38, 3),

  (null, 'Range Master', 'Reversión en rango para EURUSD. Pago único.',
   'Opera reversiones dentro de rango en EURUSD con confirmación por indicadores. Pago único de por vida. cTrader.',
   'one_time', 'month', 9900, 'usd', 'ctrader', 'EURUSD', 'range',
   '{"score":83,"ret90":"+21%","dd":"2.8%","winrate":"64%"}'::jsonb, true, true, 'active', true, true, 96, 4.8, 22, 4),

  (null, 'NY Momentum', 'Momentum en la apertura de Nueva York (NAS100).',
   'Sigue el impulso de la apertura de NY en NAS100 con trailing stop. MT5. Reglas de riesgo dentro.',
   'subscription', 'month', 2500, 'usd', 'mt5', 'NAS100', 'trend',
   '{"score":80,"ret90":"+33%","dd":"5.5%","winrate":"56%"}'::jsonb, true, true, 'active', true, true, 74, 4.5, 18, 5),

  (null, 'Swing Keeper', 'Swing de baja frecuencia en USDJPY. Pago único.',
   'Operativa de swing con pocas operaciones y drawdown bajo en USDJPY. Pago único. MT4. Pensado para cuentas conservadoras.',
   'one_time', 'month', 14900, 'usd', 'mt4', 'USDJPY', 'swing',
   '{"score":78,"ret90":"+18%","dd":"2.3%","winrate":"68%"}'::jsonb, true, true, 'active', true, true, 58, 4.7, 15, 6);
