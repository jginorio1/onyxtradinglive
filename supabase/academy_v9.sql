-- ============================================================
-- Onyx Academy · v9 — Auditoría de alumnos como add-on de pago del mentor.
-- Add-on 'audit' (nivel de pago) + consentimiento POR-MENTOR (revocable) +
-- notas privadas del mentor + "plan verificado por su mentor".
-- Idempotente: se puede correr varias veces sin romper nada.
-- Correr DESPUÉS de academy_v8.sql.
-- ============================================================

-- 1) Consentimiento del alumno para que UN mentor concreto vea su track record.
--    Granular (por mentor, no global) y revocable en cualquier momento.
create table if not exists academy_audit_consent (
  mentor_id   uuid not null,
  student_id  uuid not null,
  granted     boolean not null default true,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  primary key (mentor_id, student_id)
);
create index if not exists idx_audit_consent_mentor on academy_audit_consent (mentor_id) where granted;

-- 2) Notas privadas del mentor sobre un alumno (solo las ve el mentor).
create table if not exists academy_student_notes (
  mentor_id   uuid not null,
  student_id  uuid not null,
  notes       text,
  updated_at  timestamptz not null default now(),
  primary key (mentor_id, student_id)
);

-- 3) "Plan verificado por su mentor" — sello opcional que otorga el mentor.
create table if not exists academy_plan_verified (
  mentor_id    uuid not null,
  student_id   uuid not null,
  verified     boolean not null default false,
  verified_at  timestamptz,
  primary key (mentor_id, student_id)
);

-- 4) El add-on 'audit' es un nivel más (academy_products) con kind='audit'.
--    No hace falta columna nueva; kind ya es texto libre. Documentado aquí:
--    kind ∈ ('subscription','one_time','audit'). Un producto 'audit' concede el
--    acceso del mentor a auditar (KPIs + trades + reporte AI) mientras esté activo.

-- 5) Guardar el semáforo/score de disciplina de la última auditoría (para el panel).
alter table academy_audits add column if not exists discipline int;
alter table academy_audits add column if not exists light text;
