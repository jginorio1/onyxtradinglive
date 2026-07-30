-- Onyx Academy v6 · imágenes en posts, comentarios y chat privado.
-- Ejecutar tras academy_v5.sql.
alter table public.academy_posts    add column if not exists image_url text;
alter table public.academy_comments add column if not exists image_url text;
alter table public.academy_messages add column if not exists image_url text;
