-- ============================================================
-- Blog público (SEO). Artículos bilingües (ES/EN) que Google puede indexar,
-- con programación de publicación (draft | scheduled | published).
-- Correr una sola vez en el SQL Editor de Supabase. Idempotente.
-- ============================================================
create table if not exists blog_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title_es     text not null default '',
  title_en     text not null default '',
  excerpt_es   text default '',
  excerpt_en   text default '',
  body_es      text default '',            -- markdown
  body_en      text default '',            -- markdown
  cover_url    text,
  tags         text default '',
  status       text not null default 'draft',   -- draft | scheduled | published
  publish_at   timestamptz,                     -- cuándo se debe publicar (si scheduled)
  published_at timestamptz,                      -- cuándo se publicó de verdad
  author       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists blog_posts_status_idx on blog_posts (status, publish_at);
create index if not exists blog_posts_pub_idx    on blog_posts (published_at desc);

-- Solo el backend (service role) escribe/lee; las páginas públicas leen vía service role.
alter table blog_posts enable row level security;

notify pgrst, 'reload schema';
