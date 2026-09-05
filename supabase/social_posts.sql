-- Programación de publicaciones en redes (modo RECORDATORIO). Onyx guarda el copy
-- por red e idioma y, a la hora, te lo envía listo para pegar (Telegram/email) y lo
-- muestra en el panel. No publica solo (eso requeriría conectar la API de cada red).
create table if not exists public.social_posts (
  id            uuid primary key default gen_random_uuid(),
  blog_post_id  uuid,
  slug          text,
  network       text not null,        -- x | linkedin | facebook | telegram | whatsapp | instagram | tiktok | reddit | threads
  lang          text not null default 'es',   -- idioma de la publicación (es/en)
  copy          text not null,
  url           text,
  scheduled_at  timestamptz not null,
  status        text not null default 'pending',  -- pending | sent | canceled
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists social_posts_due_idx on public.social_posts (scheduled_at) where status = 'pending';
create index if not exists social_posts_post_idx on public.social_posts (blog_post_id);
