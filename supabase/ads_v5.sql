-- ============================================================================
-- ads_v5.sql · Propuestas personalizadas por cliente (Media Kit dirigido)
-- ----------------------------------------------------------------------------
-- Cada fila es una propuesta preparada para UN cliente concreto desde el panel.
-- El token da una URL pública única (/publicidad/propuesta?t=TOKEN) que muestra
-- la propuesta con su nombre/empresa, una nota personal y el paquete sugerido.
-- Idempotente: se puede correr varias veces sin romper nada.
-- ============================================================================
create table if not exists ad_proposals (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique,
  company      text default '',
  contact_name text default '',
  email        text default '',
  package_id   text default '',           -- id del paquete sugerido (se resalta)
  note_es      text default '',
  note_en      text default '',
  lang         text default 'es',         -- idioma con el que se abre
  status       text default 'draft',      -- draft | sent
  views        int  default 0,
  sent_at      timestamptz,
  created_at   timestamptz default now()
);
create index if not exists ad_proposals_created_idx on ad_proposals (created_at desc);
