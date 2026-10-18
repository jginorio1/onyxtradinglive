-- ============================================================
-- Onyx Trading Live · HORARIOS DE TRABAJO + FICHAJE v1
--   Vive ENCIMA de la nómina ya existente (tabla `staff`). No duplica la ficha
--   del empleado: solo le añade su horario y su reloj de entrada/salida.
--   · staff_shifts            → turnos RECURRENTES por día de la semana (plantilla)
--   · staff_shift_exceptions  → excepciones por FECHA concreta (libre / turno distinto)
--   · staff_clock             → fichaje real (entrada/salida) y horas trabajadas
--   Ejecuta en Supabase SQL Editor. Idempotente.
-- ============================================================

-- Turno recurrente: "los lunes de 09:00 a 17:00". Un empleado puede tener varios
-- turnos el mismo día (p. ej. partido mañana/tarde). Las horas son LOCALES del
-- negocio (se interpretan con la zona del panel); guardamos texto 'HH:MM'.
create table if not exists staff_shifts (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),  -- 0=domingo … 6=sábado
  start_time  text not null default '09:00',                      -- 'HH:MM'
  end_time    text not null default '17:00',                      -- 'HH:MM'
  note        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists staff_shifts_staff_idx on staff_shifts (staff_id);
create index if not exists staff_shifts_wd_idx on staff_shifts (staff_id, weekday);

-- Excepción por fecha: rompe o cambia el turno recurrente ese día concreto.
--   kind='off'    → ese día NO trabaja (festivo, día libre aprobado, etc.)
--   kind='custom' → ese día trabaja en OTRO horario (start/end obligatorios)
-- Única por (staff_id, día): la excepción más reciente manda (upsert).
create table if not exists staff_shift_exceptions (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff(id) on delete cascade,
  day         date not null,
  kind        text not null default 'off' check (kind in ('off','custom')),
  start_time  text,
  end_time    text,
  note        text,
  created_at  timestamptz not null default now()
);
create unique index if not exists staff_shift_exc_uniq on staff_shift_exceptions (staff_id, day);

-- Fichaje: un registro por sesión de trabajo. clock_out null = sigue fichado.
-- worked_min lo calculamos al cerrar (minutos), para reportes rápidos.
create table if not exists staff_clock (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff(id) on delete cascade,
  clock_in    timestamptz not null default now(),
  clock_out   timestamptz,
  worked_min  integer,                 -- se rellena al cerrar (clock_out - clock_in)
  source      text not null default 'web',   -- web | app | admin
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists staff_clock_staff_idx on staff_clock (staff_id, clock_in desc);
-- A lo sumo UN fichaje abierto por empleado (índice parcial).
create unique index if not exists staff_clock_open_uniq on staff_clock (staff_id) where clock_out is null;
