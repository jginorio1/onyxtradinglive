-- ============================================================
-- Limpieza de duplicados de blog — VERSIÓN FUERTE.
-- La versión 1 agrupaba por título EXACTO, así que si dos copias tenían un acento,
-- un espacio o un signo distinto, no se juntaban (por eso quedaron algunas).
-- Esta versión NORMALIZA el título (quita acentos, pasa a minúsculas y elimina todo
-- lo que no sea letra/número) antes de comparar, así junta las que "se ven iguales".
--
-- Uso en Supabase → SQL Editor:
--   1) Corre "VER" para revisar los grupos y cuántas copias hay.
--   2) Corre "BORRAR": conserva la más antigua de cada grupo y elimina el resto.
-- ============================================================

-- Normalizador: minúsculas → sin acentos (translate) → solo [a-z0-9].
-- (No usa la extensión unaccent para que funcione en cualquier proyecto.)
--   la clave = regexp_replace(translate(lower(title), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc'), '[^a-z0-9]', '', 'g')

-- ---------- VER (no borra): grupos con más de una copia ----------
SELECT
  regexp_replace(translate(lower(btrim(title_es)),
    'áàäâãéèëêíìïîóòöôõúùüûñç','aaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]', '', 'g') AS clave,
  count(*)        AS copias,
  min(title_es)   AS ejemplo_titulo,
  min(created_at) AS primera,
  max(created_at) AS ultima
FROM blog_posts
GROUP BY 1
HAVING count(*) > 1
ORDER BY copias DESC, ultima DESC;

-- ---------- BORRAR: conserva la más antigua de cada grupo normalizado ----------
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY regexp_replace(translate(lower(btrim(title_es)),
                          'áàäâãéèëêíìïîóòöôõúùüûñç','aaaaaeeeeiiiiooooouuuunc'),
                          '[^a-z0-9]', '', 'g')
           ORDER BY created_at ASC
         ) AS rn
  FROM blog_posts
)
DELETE FROM blog_posts
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
