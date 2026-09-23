-- ============================================================
-- Espacios patrocinados (Ads) · Fase 2
-- Autoservicio con Stripe + segmentación por país + reportes.
-- Corre este archivo una vez (después de ads.sql).
-- ============================================================

alter table ad_campaigns add column if not exists geo           text default 'all';   -- 'all' | 'US,MX,ES' (códigos ISO)
alter table ad_campaigns add column if not exists source        text default 'admin'; -- 'admin' | 'selfserve'
alter table ad_campaigns add column if not exists stripe_session text default '';       -- id de la sesión de Stripe (autoservicio)
alter table ad_campaigns add column if not exists report_token  text;                  -- token público del reporte del anunciante

create unique index if not exists ad_campaigns_report_token_idx on ad_campaigns (report_token) where report_token is not null;
create index if not exists ad_campaigns_session_idx on ad_campaigns (stripe_session) where stripe_session <> '';
