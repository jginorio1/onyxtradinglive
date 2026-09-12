-- ============================================================
-- Blog → Email a la base de datos.
-- Columnas para poder enviar un artículo por correo a los suscriptores
-- (segmento con opt-in), ya sea al publicar, en una fecha programada, o ahora.
-- Idempotente: se puede correr varias veces.
-- ============================================================
alter table if exists blog_posts add column if not exists email_enabled boolean not null default false;
alter table if exists blog_posts add column if not exists email_segment  text    not null default 'all';
alter table if exists blog_posts add column if not exists email_when     text    not null default 'publish';  -- publish | schedule | now
alter table if exists blog_posts add column if not exists email_at       timestamptz;                          -- solo si email_when = 'schedule'
alter table if exists blog_posts add column if not exists email_sent_at  timestamptz;                          -- sello: ya salió (no repetir)

-- Índice para que el cron encuentre rápido los pendientes.
create index if not exists blog_posts_email_pending_idx
  on blog_posts (email_enabled, email_sent_at)
  where email_enabled = true and email_sent_at is null;
