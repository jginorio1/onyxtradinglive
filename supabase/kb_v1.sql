-- ============================================
-- Onyx Trading Live · Base de conocimiento editable para Onyx AI
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Artículos que escribes desde el Admin y que la IA lee además de la Guía.
create table if not exists kb_articles (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  tags        text default '',        -- palabras clave separadas por coma (para la búsqueda)
  published   boolean not null default true,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists kb_articles_pub_idx on kb_articles (published, updated_at desc);

notify pgrst, 'reload schema';
