-- ============================================================
-- Onyx Academy · v16 — Grabaciones de clases, plan anual, reseñas verificadas.
-- (Los cupones se hacen con los Promotion Codes de Stripe: sin SQL.)
-- Idempotente. Correr DESPUÉS de academy_v15.sql.
-- ============================================================

-- Grabación de la clase en vivo (link de YouTube/Vimeo/.mp4).
alter table academy_events add column if not exists recording_url text;

-- Precio anual de la membresía (opcional). 0 = sin opción anual.
alter table mentors add column if not exists membership_year_cents bigint not null default 0;

-- Reseñas verificadas de alumnos (solo miembros; el mentor aprueba antes de publicar).
create table if not exists academy_reviews (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null,
  student_id  uuid not null,
  rating      int  not null default 5,   -- 1..5
  body        text,
  status      text not null default 'pending',  -- pending | approved | rejected
  created_at  timestamptz not null default now(),
  unique (mentor_id, student_id)
);
create index if not exists idx_reviews_mentor on academy_reviews (mentor_id, status);
