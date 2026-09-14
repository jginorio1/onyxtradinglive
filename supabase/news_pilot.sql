-- ============================================================
-- Piloto de noticias del blog: registro anti-duplicados de titulares vistos.
-- Cada fila = un titular ya evaluado (posted=true si se convirtió en artículo).
-- Idempotente.
-- ============================================================
create table if not exists news_seen (
  hash        text primary key,
  source      text,
  title       text,
  url         text,
  posted      boolean not null default false,
  post_id     uuid,
  created_at  timestamptz not null default now()
);

-- Búsqueda rápida de publicados de hoy (tope diario) y limpieza.
create index if not exists news_seen_posted_idx on news_seen (posted, created_at desc);

-- Marca de "noticia" en los artículos (para usar schema NewsArticle en la web).
alter table if exists blog_posts add column if not exists is_news boolean not null default false;
