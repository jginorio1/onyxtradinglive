-- =====================================================================
--  Borrar el plan "Onyx Bots" (id = 'bots')
--  Onyx Builder ya es tu plan de bots, así que este sobra.
--  Pega esto en Supabase → SQL Editor → Run.
--
--  Seguro: solo borra la fila del plan 'bots'. No toca a nadie más.
--  Si algún usuario quedó en ese plan (no debería), primero muévelo a 'free'.
-- =====================================================================

-- (Opcional) por si alguien quedó en el plan 'bots', pásalo a Gratis:
update profiles set plan = 'free' where plan = 'bots';

-- Borra el plan:
delete from plans where id = 'bots';

-- Comprueba lo que queda:
select id, name, price_month, sort, active from plans order by sort;
