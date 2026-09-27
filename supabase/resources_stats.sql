-- ============================================================
-- Panel de Recursos · función que devuelve el uso real de la base de datos y
-- del almacenamiento. SECURITY DEFINER para poder leer los catálogos del sistema
-- y el esquema storage. Solo la llama el servidor con service_role.
-- ============================================================
create or replace function public.onyx_resource_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  db_bytes  bigint;
  conns     int;
  tbls      jsonb;
  buckets   jsonb;
begin
  select pg_database_size(current_database()) into db_bytes;

  select count(*) into conns from pg_stat_activity where datname = current_database();

  select coalesce(jsonb_agg(t), '[]'::jsonb) into tbls from (
    select c.relname as name, pg_total_relation_size(c.oid) as bytes
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by pg_total_relation_size(c.oid) desc
    limit 12
  ) t;

  begin
    select coalesce(jsonb_agg(b), '[]'::jsonb) into buckets from (
      select bucket_id as name,
             coalesce(sum((metadata->>'size')::bigint), 0) as bytes,
             count(*) as objects
      from storage.objects
      group by bucket_id
      order by 2 desc
    ) b;
  exception when others then buckets := '[]'::jsonb;
  end;

  return jsonb_build_object(
    'db_bytes', db_bytes,
    'connections', conns,
    'tables', tbls,
    'buckets', buckets
  );
end;
$$;

revoke all on function public.onyx_resource_stats() from public, anon, authenticated;
grant execute on function public.onyx_resource_stats() to service_role;
