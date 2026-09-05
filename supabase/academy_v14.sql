-- ============================================================
-- Onyx Academy · v14 — Onboarding del mentor + retención (analíticas al vuelo).
-- Idempotente. Correr DESPUÉS de academy_v13.sql.
-- ============================================================

-- El mentor puede ocultar la lista de configuración una vez la completa.
alter table mentors add column if not exists onboarding_dismissed boolean not null default false;

-- (La retención usa profiles.last_seen_at, academy_enrollments.joined_at,
--  academy_memberships/purchases.status y posts/comments — ya existen.)
