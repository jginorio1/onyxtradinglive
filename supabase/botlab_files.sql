-- ============================================================
-- Onyx Bot Lab · Entrega del archivo del robot
-- Guarda el archivo (.ex5/.ex4/.set/.zip) del producto en un bucket PRIVADO
-- y lo entrega por URL firmada SOLO a quien tiene licencia activa (o al creador).
-- ============================================================

alter table if exists bot_products add column if not exists file_path text;   -- ruta en el bucket privado 'bot-files'
alter table if exists bot_products add column if not exists file_name text;   -- nombre original para la descarga
alter table if exists bot_products add column if not exists file_size bigint; -- bytes (informativo)

-- Bucket PRIVADO para los archivos de robots. Créalo también desde el panel de
-- Supabase → Storage si no existe (Public = OFF). Estas líneas lo aseguran por SQL.
insert into storage.buckets (id, name, public)
values ('bot-files', 'bot-files', false)
on conflict (id) do nothing;
