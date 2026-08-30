-- ============================================================
-- Onyx · Precarga de 10 reseñas de ejemplo para el landing "Crea tu bot".
-- Ejecuta en Supabase → SQL Editor. Solo mezcla la clave 'reviews' dentro de
-- app_settings.landing_stats (no toca las demás cifras). Reejecutable.
--
-- Después puedes editarlas o borrarlas desde Admin → Módulos → Cifras del landing,
-- o generar nuevas con el botón "✨ Generar reseña con IA" (ES/EN).
-- ============================================================

insert into app_settings (key, value, updated_at)
values ('landing_stats', jsonb_build_object('reviews', '[
  {"lang":"es","country":"MX","name":"Andrés M.","result":"FTMO 100K pasado","stars":5,"date":"12 mar 2026","text":"Armé mi bot en una tarde sin saber programar. Pasé la fase 1 de FTMO sin acercarme al límite diario. Ver el drawdown en vivo me dio mucha tranquilidad."},
  {"lang":"es","country":"AR","name":"Valeria R.","result":"FundedNext 50K","stars":5,"date":"28 feb 2026","text":"Antes rompía cuentas por sobreoperar; ahora el bot se frena solo y ya. Recomendadísimo."},
  {"lang":"es","country":"CL","name":"Carlos T.","result":"The5ers","stars":4,"date":"5 abr 2026","text":"Me costó entender los parciales al inicio, pero la guía en PDF lo explica paso a paso. Llevo 2 meses sin romper."},
  {"lang":"es","country":"ES","name":"Diego S.","result":"cTrader","stars":5,"date":"19 ene 2026","text":"Funciona idéntico en cTrader, que era mi duda. Encontró el símbolo solo con el sufijo de mi bróker."},
  {"lang":"es","country":"CO","name":"María José P.","result":"FundingPips 25K","stars":5,"date":"8 mar 2026","text":"El filtro de noticias me salvó de un NFP que me hubiera reventado. Pasé mi primer reto con mi propio bot."},
  {"lang":"es","country":"PE","name":"PipsConDani","result":"2 cuentas","stars":5,"date":"22 abr 2026","text":"Tengo el bot en dos cuentas y veo todo en un panel. El registro automático me ahorra el diario a mano."},
  {"lang":"en","country":"US","name":"Ryan A.","result":"FTMO 200K","stars":5,"date":"Feb 14 2026","text":"Support helped me tune my per-trade risk. You can tell they know funded trading. Hit the target in 3 weeks."},
  {"lang":"en","country":"GB","name":"James","result":"cTrader","stars":5,"date":"Apr 5 2026","text":"Same EA works on cTrader, which was my worry. It found my broker symbol suffix on its own. Flawless."},
  {"lang":"en","country":"CA","name":"NoStopLoss_","result":"Demo to live","stars":4,"date":"Mar 30 2026","text":"Tested a month on demo before going live, as recommended. Zero surprises on the real account."},
  {"lang":"en","country":"AU","name":"Liam O.","result":"Multi-broker","stars":5,"date":"May 2 2026","text":"Switched brokers and the same bot kept trading without touching anything. Worth the subscription alone."},
  {"lang":"en","country":"ZA","name":"Sarah K.","result":"FundedNext 100K","stars":5,"date":"Apr 11 2026","text":"Never thought I would own a bot. The personalized PDF guide with my name and the bot name is brilliant."},
  {"lang":"en","country":"US","name":"David R.","result":"FundingPips 25K","stars":5,"date":"Mar 8 2026","text":"The built-in news filter saved me from an NFP spike. Passed my first challenge with my own bot."}
]'::jsonb), now())
on conflict (key) do update
  set value = app_settings.value || excluded.value,   -- fusiona: solo agrega/renueva 'reviews'
      updated_at = now();

notify pgrst, 'reload schema';
