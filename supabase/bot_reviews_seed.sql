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
  {"name":"Andrés M.","result":"FTMO 100K pasado","stars":5,"date":"12 mar 2026","text":"Armé mi bot en una tarde sin saber programar. Pasé la fase 1 de FTMO sin acercarme al límite diario. Ver el drawdown en vivo me dio mucha tranquilidad."},
  {"name":"Valeria R.","result":"FundedNext 50K","stars":5,"date":"28 feb 2026","text":"Antes rompía cuentas por sobreoperar; ahora el bot se frena solo y ya. Recomendadísimo."},
  {"name":"Carlos T.","result":"The5ers","stars":4,"date":"5 abr 2026","text":"Me costó entender los parciales al inicio, pero la guía en PDF lo explica paso a paso. Llevo 2 meses sin romper."},
  {"name":"Diego S.","result":"cTrader","stars":5,"date":"19 ene 2026","text":"Funciona idéntico en cTrader, que era mi duda. Encontró el símbolo solo con el sufijo de mi bróker."},
  {"name":"María José P.","result":"FundingPips 25K","stars":5,"date":"8 mar 2026","text":"El filtro de noticias me salvó de un NFP que me hubiera reventado. Pasé mi primer reto con mi propio bot."},
  {"name":"Jonathan V.","result":"2 cuentas","stars":5,"date":"22 abr 2026","text":"Tengo el bot en dos cuentas y veo todo en un panel. El registro automático me ahorra el diario a mano."},
  {"name":"Sofía L.","result":"FTMO 200K","stars":5,"date":"14 feb 2026","text":"El soporte me ayudó a ajustar el riesgo por operación. Se nota que entienden de fondeo. Objetivo en 3 semanas."},
  {"name":"Ricardo A.","result":"Demo a real","stars":4,"date":"30 mar 2026","text":"Lo probé un mes en demo antes de real, como recomiendan. Cero sorpresas al pasar a real."},
  {"name":"Luisa F.","result":"FundedNext 100K","stars":5,"date":"11 abr 2026","text":"Nunca pensé que tendría un robot propio. La guía personalizada con mi nombre y el del bot está buenísima."},
  {"name":"Kevin O.","result":"Multi-broker","stars":5,"date":"2 may 2026","text":"Cambié de bróker y el mismo bot siguió operando sin tocar nada. Eso solo ya vale la suscripción."}
]'::jsonb), now())
on conflict (key) do update
  set value = app_settings.value || excluded.value,   -- fusiona: solo agrega/renueva 'reviews'
      updated_at = now();

notify pgrst, 'reload schema';
