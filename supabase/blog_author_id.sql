-- Autor por artículo (varios autores). Cada post guarda el id del autor que lo
-- escribió; el perfil vive en ajustes (blog_authors). Cambiar el autor por defecto
-- NO afecta a los artículos ya asignados.
alter table public.blog_posts add column if not exists author_id text;
