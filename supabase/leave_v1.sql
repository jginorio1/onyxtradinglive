-- ============================================================
-- Onyx Trading Live · DÍAS LIBRES / AUSENCIAS v1
--   Vive ENCIMA de la nómina (`staff`) y se enlaza con HORARIOS (schedule_v1):
--   al APROBAR una solicitud, cada día se marca como excepción 'off' en
--   staff_shift_exceptions, así aparece "libre" en el calendario del horario.
--   · staff_leave_balance   → asignación ANUAL por tipo (opcional; si falta, se usa
--                             la política por defecto de app_settings 'leave_policy')
--   · staff_leave_requests  → solicitudes del empleado con su estado
--   Ejecuta en Supabase SQL Editor. Idempotente.
-- ============================================================

-- Asignación anual por empleado y tipo. Si no hay fila, se usa la política global.
-- Permite dar más/menos días a una persona concreta (ej. antigüedad).
create table if not exists staff_leave_balance (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  year       smallint not null,
  type       text not null check (type in ('vacation','sick','personal')),
  allotted   numeric not null default 0,   -- días asignados ese año para ese tipo
  note       text,
  updated_at timestamptz not null default now()
);
create unique index if not exists staff_leave_bal_uniq on staff_leave_balance (staff_id, year, type);

-- Solicitud de días libres. days = nº de días del rango (inclusive). El saldo
-- RESTANTE se calcula = asignado − (suma de días APROBADOS de ese tipo en el año).
create table if not exists staff_leave_requests (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff(id) on delete cascade,
  type        text not null default 'vacation' check (type in ('vacation','sick','personal')),
  start_day   date not null,
  end_day     date not null,
  days        numeric not null default 1,
  reason      text,
  status      text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  admin_note  text,
  decided_by  uuid,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists staff_leave_req_staff_idx on staff_leave_requests (staff_id, created_at desc);
create index if not exists staff_leave_req_status_idx on staff_leave_requests (status);
