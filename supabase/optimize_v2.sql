-- Tamaño de la base y de cada tabla, para la pestaña Optimización.
-- SECURITY DEFINER: lo llama la app con la clave de servicio.

create or replace function public.db_total_size()
returns bigint
language sql security definer set search_path = public
as $$ select pg_database_size(current_database()); $$;

create or replace function public.db_table_sizes()
returns table(name text, bytes bigint, rows bigint)
language sql security definer set search_path = public
as $$
  select c.relname::text,
         pg_total_relation_size(c.oid)::bigint,
         greatest(c.reltuples, 0)::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc
  limit 8;
$$;

revoke all on function public.db_total_size() from public;
revoke all on function public.db_table_sizes() from public;
