-- ============================================================
-- Onyx Academy · v11 — Muro de Logros + "en línea" de miembros.
-- Idempotente. Correr DESPUÉS de academy_v10.sql.
-- ============================================================

-- Muro de Logros: el alumno sube su prueba (retiro, reto superado, certificado…),
-- entra a la cola del mentor y este la aprueba antes de publicarla.
create table if not exists academy_wins (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null,
  student_id   uuid not null,
  kind         text not null default 'payout',   -- payout | challenge | certificate | goal
  title        text,
  amount_cents bigint,                            -- opcional (monto del retiro/reto)
  currency     text default 'usd',
  prop_firm    text,                              -- opcional
  image_url    text,                              -- prueba (captura/certificado)
  status       text not null default 'pending',   -- pending | approved | rejected
  verified     boolean not null default false,    -- sello del mentor
  likes        int not null default 0,
  created_at   timestamptz not null default now(),
  approved_at  timestamptz
);
create index if not exists idx_wins_mentor on academy_wins (mentor_id, status, created_at desc);
create index if not exists idx_wins_student on academy_wins (student_id);

-- Likes/felicitaciones a un logro (un like por usuario).
create table if not exists academy_win_likes (
  win_id   uuid not null,
  user_id  uuid not null,
  primary key (win_id, user_id)
);

-- "En línea": última actividad del usuario (para el puntito verde).
alter table profiles add column if not exists last_seen_at timestamptz;
