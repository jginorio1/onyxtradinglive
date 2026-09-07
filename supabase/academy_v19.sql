-- ============================================================
-- Onyx Academy · v19 — Suscripciones abrir/cerrar + lista de espera,
-- tipos de publicación, y anuncios. Idempotente. Correr tras academy_v18.sql.
-- ============================================================

-- ¿Acepta nuevas suscripciones? Cierre con o sin fecha de reapertura.
alter table mentors add column if not exists subs_open boolean not null default true;
alter table mentors add column if not exists subs_reopen_at timestamptz;      -- null = sin fecha
alter table mentors add column if not exists subs_closed_note text;           -- mensaje opcional

-- Tipo de publicación de la comunidad + subtipo de logro.
-- kind: community | analysis | habits | question | win   (default community)
-- win_kind: payout | challenge | goal  (solo cuando kind = win)
alter table academy_posts add column if not exists kind text not null default 'community';
alter table academy_posts add column if not exists win_kind text;
-- Marca de "anuncio destacado" (además de pinned).
alter table academy_posts add column if not exists announcement boolean not null default false;

-- Lista de espera: visitantes que quieren aviso cuando reabran las inscripciones.
create table if not exists academy_waitlist (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null,
  email       text not null,
  created_at  timestamptz not null default now(),
  unique (mentor_id, email)
);
create index if not exists idx_waitlist_mentor on academy_waitlist (mentor_id);

notify pgrst, 'reload schema';
