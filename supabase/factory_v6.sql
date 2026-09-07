-- ============================================================
-- Onyx Bot Factory · v6
--  · Biblioteca de datos reutilizable: se guarda la fuente, el tipo (ticks/barras),
--    el rango de años y la ruta de las barras OHLC en Storage.
--  · Así los datos se suben UNA sola vez en la Puerta 0 y se reutilizan en el
--    Constructor, el Motor y el Laboratorio sin volver a subir nada.
-- ============================================================

alter table public.factory_datasets add column if not exists source     text;      -- dukascopy | metatrader | otro
alter table public.factory_datasets add column if not exists broker     text;      -- broker (si la fuente es MetaTrader)
alter table public.factory_datasets add column if not exists data_kind  text;      -- ticks | bars
alter table public.factory_datasets add column if not exists from_year  int;
alter table public.factory_datasets add column if not exists to_year    int;
alter table public.factory_datasets add column if not exists bars_path  text;      -- ruta en Storage del OHLC reutilizable
alter table public.factory_datasets add column if not exists bars_url   text;      -- URL pública del OHLC
alter table public.factory_datasets add column if not exists bars_tf    int;       -- temporalidad de las barras guardadas (minutos)
alter table public.factory_datasets add column if not exists bars_count bigint;    -- nº de barras OHLC guardadas
alter table public.factory_datasets add column if not exists file_size  bigint;    -- tamaño del archivo original (bytes)

-- Bucket para la biblioteca de datos (barras OHLC comprimidas). Público como el resto.
insert into storage.buckets (id, name, public)
values ('factory-data', 'factory-data', true)
on conflict (id) do nothing;

-- Recarga el caché de esquema de PostgREST para que vea las columnas nuevas.
notify pgrst, 'reload schema';
