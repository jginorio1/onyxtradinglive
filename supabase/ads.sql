-- ============================================================
-- Espacios patrocinados (Ads) · Fase 1 (solo web)
-- Corre este archivo una vez en Supabase → SQL Editor.
-- ============================================================

create table if not exists ad_campaigns (
  id           uuid primary key default gen_random_uuid(),
  advertiser   text not null default '',       -- nombre del anunciante
  contact      text default '',                -- email/teléfono (para reservas)
  slot_key     text not null,                  -- ubicación (ver lib/ads.ts AD_SLOTS)
  creative_url text default '',                -- imagen del banner (URL pública)
  link_url     text default '',                -- destino al hacer clic
  alt          text default '',                -- texto alternativo (accesibilidad)
  lang         text not null default 'all',    -- 'all' | 'es' | 'en'
  starts_at    timestamptz,
  ends_at      timestamptz,
  weight       int not null default 1,         -- peso en la rotación
  price        numeric default 0,              -- lo que se cobró (informativo)
  status       text not null default 'draft',  -- draft | scheduled | active | paused | ended
  impressions  bigint not null default 0,
  clicks       bigint not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists ad_campaigns_slot_idx on ad_campaigns (slot_key, status);

-- Incremento ATÓMICO de impresiones/clics (evita condiciones de carrera).
create or replace function ad_bump(p_id uuid, p_kind text) returns void as $$
begin
  if p_kind = 'click' then
    update ad_campaigns set clicks = clicks + 1 where id = p_id;
  else
    update ad_campaigns set impressions = impressions + 1 where id = p_id;
  end if;
end;
$$ language plpgsql;
