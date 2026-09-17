-- ============================================================
-- Limpieza de artículos de blog DUPLICADOS por título.
-- La misma noticia se publicó varias veces (mismo título, distinta URL de fuente).
-- Este script CONSERVA el más antiguo de cada título y borra los repetidos.
--
-- Cómo usarlo en Supabase:
--   1) Abre el proyecto → SQL Editor.
--   2) (Opcional) Corre primero el bloque "VER" para revisar qué se va a borrar.
--   3) Corre el bloque "BORRAR". Es seguro: solo elimina copias, deja 1 de cada.
-- ============================================================

-- ---------- VER (no borra nada): cuántas copias hay por título ----------
SELECT lower(btrim(title_es)) AS titulo,
       count(*)               AS copias,
       min(created_at)        AS primera,
       max(created_at)        AS ultima
FROM blog_posts
GROUP BY lower(btrim(title_es))
HAVING count(*) > 1
ORDER BY copias DESC, ultima DESC;

-- ---------- BORRAR: conserva la más antigua de cada título ----------
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lower(btrim(title_es))
           ORDER BY created_at ASC
         ) AS rn
  FROM blog_posts
)
DELETE FROM blog_posts
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ---------- (Opcional) limpiar el registro "visto" para que el anti-duplicados
--            por título empiece limpio. No es obligatorio. ----------
-- DELETE FROM news_seen WHERE created_at < now() - interval '1 day';
