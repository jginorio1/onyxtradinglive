-- ============================================================
-- Blog · imágenes con texto alternativo (alt) bilingüe.
-- El alt de la PORTADA se guarda aquí; el alt de las imágenes dentro del
-- cuerpo va incrustado en el propio markdown ![alt](url), así que no necesita
-- columnas nuevas. Correr una sola vez. Idempotente.
-- ============================================================
alter table if exists public.blog_posts
  add column if not exists cover_alt_es text default '',
  add column if not exists cover_alt_en text default '';

notify pgrst, 'reload schema';
