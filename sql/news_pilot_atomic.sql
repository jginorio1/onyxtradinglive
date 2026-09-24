-- ============================================================
-- TOPE DIARIO + SEPARACIÓN MÍNIMA DEL PILOTO DE NOTICIAS — DE FORMA ATÓMICA.
--
-- Por qué: el tope se hacía cumplir en varios pasos (leer contador → generar el
-- artículo con IA, que tarda 10-30s → escribir contador). Dos corridas del cron
-- casi simultáneas leían "aún no llegué al tope" ANTES de que la otra grabara su
-- post, así que las dos publicaban. Con el cron cada 3 min esto se disparaba y se
-- publicaban decenas al día pese al tope de 3.
--
-- Solución: una tabla-contador por día (UTC) y una función que RESERVA el turno
-- bajo un candado de fila (SELECT ... FOR UPDATE). Postgres serializa las llamadas
-- concurrentes sobre la misma fila, así que JAMÁS se puede pasar del tope ni de la
-- separación mínima, caigan 1 o 100 corridas a la vez.
--
-- Instalación: pega TODO este archivo en Supabase → SQL Editor → Run. Es idempotente
-- (se puede correr varias veces sin problema).
-- ============================================================

create table if not exists news_pilot_counter (
  day     date primary key,
  count   integer not null default 0,
  last_at timestamptz
);

-- RESERVA un turno para HOY (UTC). Devuelve { ok:true, count } si concede, o
-- { ok:false, reason:'cap'|'gap' } si no. Atómica: bloquea la fila del día.
--   p_max     = máximo de artículos por día
--   p_gap_min = minutos mínimos entre artículos (0 = sin separación)
create or replace function news_pilot_claim(p_max integer, p_gap_min integer)
returns jsonb
language plpgsql
as $$
declare
  d   date := (now() at time zone 'utc')::date;
  cur record;
begin
  -- Siembra la fila del día con lo YA publicado hoy (por si tras un despliegue el
  -- día ya traía artículos). Solo la primera vez del día; luego on conflict no toca.
  insert into news_pilot_counter(day, count, last_at)
  select d,
         count(*)::int,
         max(coalesce(published_at, created_at))
  from blog_posts
  where status = 'published'
    and coalesce(is_news, false) = true
    and coalesce(published_at, created_at) >= d::timestamptz
  on conflict (day) do nothing;

  -- Candado de fila: las corridas concurrentes esperan aquí y entran de una en una.
  select * into cur from news_pilot_counter where day = d for update;

  if cur.count >= p_max then
    return jsonb_build_object('ok', false, 'reason', 'cap', 'count', cur.count, 'day', d);
  end if;

  if p_gap_min > 0 and cur.last_at is not null
     and (now() - cur.last_at) < make_interval(mins => p_gap_min) then
    return jsonb_build_object('ok', false, 'reason', 'gap', 'count', cur.count, 'day', d);
  end if;

  update news_pilot_counter
     set count = cur.count + 1, last_at = now()
   where day = d;

  return jsonb_build_object('ok', true, 'count', cur.count + 1, 'day', d);
end;
$$;

-- DEVUELVE un turno reservado (si tras reservar falló la generación/guardado, para
-- que ese fallo transitorio no "gaste" un cupo del día). Resta 1 al contador de hoy.
create or replace function news_pilot_release()
returns void
language plpgsql
as $$
declare d date := (now() at time zone 'utc')::date;
begin
  update news_pilot_counter set count = greatest(count - 1, 0) where day = d;
end;
$$;

-- ESTADO de hoy para el panel (sin efectos). Si aún no hay fila del día, calcula en
-- vivo desde el blog para que "Publicados hoy" y el cierre por tope coincidan.
create or replace function news_pilot_status()
returns jsonb
language plpgsql
as $$
declare
  d  date := (now() at time zone 'utc')::date;
  c  integer;
  la timestamptz;
begin
  select count, last_at into c, la from news_pilot_counter where day = d;
  if c is null then
    select count(*)::int, max(coalesce(published_at, created_at)) into c, la
    from blog_posts
    where status = 'published'
      and coalesce(is_news, false) = true
      and coalesce(published_at, created_at) >= d::timestamptz;
  end if;
  return jsonb_build_object(
    'day', d,
    'count', coalesce(c, 0),
    'last_at', case when la is null then null
      else to_char(la at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end
  );
end;
$$;
