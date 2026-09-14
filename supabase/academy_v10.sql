-- ============================================================
-- Onyx Academy · v10 — Branding del mentor, logo/foto, redes sociales,
-- toggle de emojis del AI y plantillas de correos automáticos editables.
-- Idempotente. Correr DESPUÉS de academy_v9.sql.
-- ============================================================

-- Logo/foto del mentor (reemplaza el ícono del hero).
alter table mentors add column if not exists logo_url text;

-- Info de marca que el AI usa como contexto (historia, tono de voz, propuesta).
alter table mentors add column if not exists brand_info text;

-- ¿El AI usa emojis? (el mentor decide).
alter table mentors add column if not exists ai_emojis boolean not null default true;

-- Redes sociales del mentor (whatsapp, instagram, facebook, tiktok, youtube,
-- telegram, x). Guardamos usuario o URL; el front arma el enlace.
alter table mentors add column if not exists socials jsonb not null default '{}'::jsonb;

-- Plantillas editables de correos automáticos por-tipo:
-- { welcome:{enabled,subject,body}, class_reminder:{enabled,subject,body,lead_min},
--   expiring:{enabled,subject,body,days_before} }
alter table mentors add column if not exists email_templates jsonb not null default '{}'::jsonb;
