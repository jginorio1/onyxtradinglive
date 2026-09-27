-- ============================================================
-- Onyx Academy · v12 — Colaboradores con roles/permisos + etiqueta.
-- Idempotente. Correr DESPUÉS de academy_v11.sql.
-- ============================================================

-- Colaboradores de la academia: el mentor invita a un miembro, le pone un rol
-- (etiqueta visible) y permisos. perms: { moderate, post, message, events }.
create table if not exists academy_collaborators (
  mentor_id   uuid not null,
  user_id     uuid not null,
  role        text not null default 'Colaborador',   -- etiqueta que se muestra
  perms       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  primary key (mentor_id, user_id)
);
create index if not exists idx_collab_mentor on academy_collaborators (mentor_id);
