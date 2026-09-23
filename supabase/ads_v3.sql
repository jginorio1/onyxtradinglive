-- ============================================================
-- Onyx Ads · Fases 3–6 (nivel profesional)
-- Corre DESPUÉS de ads.sql y ads_v2.sql. Todo idempotente.
--
-- F3 · Control de artes + formatos IAB + aprobación obligatoria
-- F4 · Inventario nuevo + geo por tier
-- F5 · Modelos CPM/CPC/CPA + cuenta de anunciante + antifraude
-- F6 · Programmatic fallback + patrocinios + directorio + enterprise
-- ============================================================

-- ---- F3: control de artes y revisión -----------------------
alter table ad_campaigns add column if not exists creative_path text default '';      -- ruta del arte en NUESTRO storage (congelado)
alter table ad_campaigns add column if not exists creative_w    int  default 0;        -- ancho detectado del arte
alter table ad_campaigns add column if not exists creative_h    int  default 0;        -- alto detectado
alter table ad_campaigns add column if not exists reviewed_at   timestamptz;           -- cuándo se revisó
alter table ad_campaigns add column if not exists reviewed_by   text default '';        -- quién revisó
alter table ad_campaigns add column if not exists review_note   text default '';        -- motivo de rechazo / nota
alter table ad_campaigns add column if not exists category      text default 'general'; -- broker | propfirm | tool | education | general
alter table ad_campaigns add column if not exists disclaimer    boolean default false;  -- muestra aviso de riesgo financiero
-- status ahora admite: draft | pending | active | paused | rejected | ended

-- ---- F4: geo por tier --------------------------------------
alter table ad_campaigns add column if not exists geo_tier text default '';            -- '' | 't1' | 't2' | 't3' (además de geo por país)
alter table ad_campaigns add column if not exists geo_exclude text default '';         -- países a excluir por compliance (ISO, coma)

-- ---- F5: modelos de cobro + pacing + segmentación ----------
alter table ad_campaigns add column if not exists pricing_model text default 'flat';   -- flat | cpm | cpc | cpa
alter table ad_campaigns add column if not exists budget       numeric default 0;      -- presupuesto total (cpm/cpc/cpa)
alter table ad_campaigns add column if not exists spent        numeric default 0;      -- gastado acumulado
alter table ad_campaigns add column if not exists daily_cap    numeric default 0;      -- tope de gasto diario (0 = sin tope)
alter table ad_campaigns add column if not exists spent_today  numeric default 0;      -- gasto del día en curso
alter table ad_campaigns add column if not exists spent_day    text default '';        -- YYYY-MM-DD del contador de arriba
alter table ad_campaigns add column if not exists device       text default 'all';     -- all | desktop | mobile
alter table ad_campaigns add column if not exists conversions  int  default 0;         -- señales CPA
alter table ad_campaigns add column if not exists advertiser_id uuid;                   -- dueño (cuenta de anunciante)

-- Cuenta de anunciante (autoservicio con wallet + varias campañas)
create table if not exists ad_advertisers (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  name         text default '',
  company      text default '',
  kind         text default 'self',       -- self | enterprise
  balance      numeric default 0,          -- saldo del wallet (USD)
  country      text default '',
  status       text default 'active',      -- active | suspended
  access_token text unique,                -- token del panel del anunciante (sin login)
  created_at   timestamptz default now()
);
create index if not exists ad_advertisers_email_idx on ad_advertisers (lower(email));

-- Movimientos del wallet (recargas y gastos)
create table if not exists ad_wallet_txns (
  id            uuid primary key default gen_random_uuid(),
  advertiser_id uuid references ad_advertisers(id) on delete cascade,
  kind          text not null,             -- topup | spend | refund | adjust
  amount        numeric not null,          -- + recarga, - gasto
  note          text default '',
  campaign_id   uuid,
  created_at    timestamptz default now()
);
create index if not exists ad_wallet_txns_adv_idx on ad_wallet_txns (advertiser_id, created_at desc);

-- Rollup diario de métricas por campaña (para reportes por día/geo/dispositivo)
create table if not exists ad_stats_daily (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  day         date not null,
  country     text default '',
  device      text default 'all',
  impressions int default 0,
  views       int default 0,               -- viewable (IAB 50%/1s)
  clicks      int default 0,
  conversions int default 0,
  spend       numeric default 0,
  unique (campaign_id, day, country, device)
);
create index if not exists ad_stats_daily_camp_idx on ad_stats_daily (campaign_id, day desc);

-- Antifraude: una impresión por visitante/campaña/día (dedupe)
create table if not exists ad_impression_log (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  visitor     text not null,               -- hash de IP+UA (sin PII)
  day         date not null,
  created_at  timestamptz default now(),
  unique (campaign_id, visitor, day)
);

-- ---- F6: directorio de partners (CPA brokers/prop firms) ----
create table if not exists ad_partners (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  logo_url     text default '',
  blurb_es     text default '',
  blurb_en     text default '',
  link_url     text not null,              -- enlace afiliado
  category     text default 'broker',      -- broker | propfirm | tool
  geo          text default 'all',
  cpa_payout   numeric default 0,          -- pago por registro/fondeo (referencia)
  featured     boolean default false,      -- destacado (paga más)
  rank         int default 100,
  regulated    text default '',            -- reguladores (texto libre, compliance)
  clicks       int default 0,
  signups      int default 0,
  status       text default 'active',
  created_at   timestamptz default now()
);
create index if not exists ad_partners_status_idx on ad_partners (status, featured, rank);

-- RPCs de incremento atómico (best-effort desde el server)
create or replace function ad_partner_bump(p_id uuid, p_kind text)
returns void language plpgsql as $$
begin
  if p_kind = 'click' then update ad_partners set clicks = clicks + 1 where id = p_id;
  elsif p_kind = 'signup' then update ad_partners set signups = signups + 1 where id = p_id;
  end if;
end; $$;

-- Suma métricas al rollup diario (crea la fila si no existe)
create or replace function ad_stat_bump(p_campaign uuid, p_day date, p_country text, p_device text,
                                        p_imp int, p_view int, p_click int, p_conv int, p_spend numeric)
returns void language plpgsql as $$
begin
  insert into ad_stats_daily (campaign_id, day, country, device, impressions, views, clicks, conversions, spend)
  values (p_campaign, p_day, coalesce(p_country,''), coalesce(p_device,'all'), p_imp, p_view, p_click, p_conv, p_spend)
  on conflict (campaign_id, day, country, device) do update set
    impressions = ad_stats_daily.impressions + p_imp,
    views       = ad_stats_daily.views + p_view,
    clicks      = ad_stats_daily.clicks + p_click,
    conversions = ad_stats_daily.conversions + p_conv,
    spend       = ad_stats_daily.spend + p_spend;
end; $$;
