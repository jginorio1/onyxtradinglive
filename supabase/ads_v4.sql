-- Onyx Ads · v4 · banner propio por socio del directorio (CPA).
-- Corre después de ads_v3.sql. Idempotente.
alter table ad_partners add column if not exists banner_url text default '';  -- imagen de banner del broker/prop firm (la que dan en su programa de afiliados)
