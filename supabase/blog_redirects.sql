-- Redirecciones 301 del blog. Cuando se cambia el slug de un artículo ya publicado,
-- guardamos aquí la URL vieja → la nueva para no perder el posicionamiento ni
-- dejar 404s. La página /blog/[slug] redirige (301 permanente) si no encuentra el
-- artículo pero sí una redirección.
create table if not exists public.blog_redirects (
  from_slug   text primary key,
  to_slug     text not null,
  created_at  timestamptz not null default now()
);
