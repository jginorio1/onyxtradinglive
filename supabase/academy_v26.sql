-- Onyx Academy v26 · Becas Fase 2: solicitudes + recordatorios. Tras academy_v25.sql.

-- Solicitudes de beca de un alumno a una academia (el mentor aprueba/rechaza).
create table if not exists public.academy_scholarship_apps (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null,
  student_id   uuid not null,
  message      text,                                -- por qué la necesita
  reason       text default 'low_income',           -- low_income | merit | other
  status       text not null default 'pending',     -- pending | approved | denied
  mentor_note  text,
  grant_id     uuid,                                -- beca creada al aprobar
  decided_by   uuid,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists academy_schapp_mentor  on public.academy_scholarship_apps(mentor_id, status);
create index if not exists academy_schapp_student on public.academy_scholarship_apps(student_id, status);

-- Recordatorio de vencimiento enviado (para no repetirlo).
alter table public.academy_scholarships add column if not exists reminder_sent boolean not null default false;
