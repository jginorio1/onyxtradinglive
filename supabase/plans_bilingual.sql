-- ============================================================
-- Onyx · Planes BILINGÜES (ES/EN)
-- Ejecuta en Supabase → SQL Editor (proyecto aohupkoamqnmeyqduuxa)
-- Seguro de re-ejecutar: solo añade columnas y rellena si están vacías.
-- ============================================================

-- Campos en inglés + descripción corta en ambos idiomas
alter table plans add column if not exists name_en     text;
alter table plans add column if not exists desc_es     text;
alter table plans add column if not exists desc_en     text;
alter table plans add column if not exists features_en jsonb not null default '[]'::jsonb;
alter table plans add column if not exists badge_en    text;

-- Rellenar inglés de los 3 planes base (solo si están vacíos)
update plans set
  name_en     = coalesce(nullif(name_en, ''), 'Free'),
  desc_es     = coalesce(nullif(desc_es, ''), 'Empieza a registrar tu trading'),
  desc_en     = coalesce(nullif(desc_en, ''), 'Start tracking your trading'),
  badge_en    = coalesce(badge_en, badge),
  features_en = case when features_en = '[]'::jsonb
                     then '["1 MT account","Basic stats","30 days of history"]'::jsonb
                     else features_en end
where id = 'free';

update plans set
  name_en     = coalesce(nullif(name_en, ''), 'Pro'),
  desc_es     = coalesce(nullif(desc_es, ''), 'Todo lo necesario para mejorar'),
  desc_en     = coalesce(nullif(desc_en, ''), 'Everything you need to improve'),
  badge_en    = coalesce(nullif(badge_en, ''), 'Most popular'),
  features_en = case when features_en = '[]'::jsonb
                     then '["5 MT accounts","All stats","Unlimited history","Calendar & charts","Prop-firm rules"]'::jsonb
                     else features_en end
where id = 'pro';

update plans set
  name_en     = coalesce(nullif(name_en, ''), 'Elite'),
  desc_es     = coalesce(nullif(desc_es, ''), 'Escala tu operativa'),
  desc_en     = coalesce(nullif(desc_en, ''), 'Scale your trading'),
  badge_en    = coalesce(badge_en, badge),
  features_en = case when features_en = '[]'::jsonb
                     then '["Unlimited accounts","Everything in Pro","Automatic reports","Telegram alerts","Priority support"]'::jsonb
                     else features_en end
where id = 'elite';

-- Refrescar la caché de PostgREST
notify pgrst, 'reload schema';
