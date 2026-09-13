-- ============================================================
-- Onyx Bot Factory · v7
--  · Guarda los TICKS REALES del dataset en Storage (máxima fidelidad, como
--    StrategyQuant). Se sube directo del navegador a Supabase (sin pasar por
--    Vercel), por eso soporta archivos de varios GB.
--  · Las barras M1 se guardan aparte para la generación masiva rápida.
-- ============================================================

alter table public.factory_datasets add column if not exists tick_path   text;   -- ruta del archivo de ticks reales en Storage
alter table public.factory_datasets add column if not exists tick_url    text;   -- URL pública del archivo de ticks
alter table public.factory_datasets add column if not exists tick_size   bigint; -- tamaño del archivo de ticks (bytes)
alter table public.factory_datasets add column if not exists tick_format text;   -- p.ej. dukascopy-csv

-- Asegura el bucket (público) para la biblioteca de datos.
insert into storage.buckets (id, name, public)
values ('factory-data', 'factory-data', true)
on conflict (id) do nothing;

-- Sube el límite de tamaño de archivo del bucket (por si el proyecto lo tiene bajo).
-- Ajusta el número si tu plan lo permite (bytes). 6 GB = 6442450944.
update storage.buckets set file_size_limit = 6442450944 where id = 'factory-data';

-- Política: permite a usuarios autenticados subir/leer en el bucket factory-data
-- (las subidas van con URL firmada creada por el admin, pero dejamos la policy por si acaso).
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'factory_data_rw') then
    create policy factory_data_rw on storage.objects
      for all to authenticated
      using (bucket_id = 'factory-data')
      with check (bucket_id = 'factory-data');
  end if;
end $$;

notify pgrst, 'reload schema';
