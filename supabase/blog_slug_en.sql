-- Slug propio para el idioma inglés. Así /blog/<slug-es> queda en español y
-- /en/blog/<slug-en> en inglés (URLs localizadas, mejor SEO). Si un post no tiene
-- slug_en, el inglés cae al slug español (compatibilidad con lo ya publicado).
alter table public.blog_posts add column if not exists slug_en text;
create index if not exists blog_posts_slug_en_idx on public.blog_posts (slug_en) where slug_en is not null;
