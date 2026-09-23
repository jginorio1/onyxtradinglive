-- ============================================
-- Onyx Trading Live · Red de VENTAS v2
--   · Reclutamiento (solicitudes desde la landing oculta)
--   · Correo con el dominio para cada representante (from/alias + reply-to)
-- Ejecuta después de sales_v1.sql.
-- ============================================

-- Solicitudes de reclutamiento (las envía la landing oculta /unete-ventas).
create table if not exists sales_applications (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null,
  phone text,
  country text,
  desired_role text,            -- vendedor | supervisor (lo que pide el candidato)
  experience text,              -- experiencia comercial / comunidad
  audience text,                -- dónde vende / a quién llega
  note text,                    -- mensaje libre del candidato
  status text not null default 'pending',   -- pending | approved | rejected
  reviewed_by uuid references auth.users(id) on delete set null,
  rep_id uuid references sales_reps(id) on delete set null,   -- rep creado al aprobar
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

create index if not exists sales_apps_status_idx on sales_applications (status, created_at);

-- Correo con el dominio: cada representante puede escribir a sus clientes con una
-- dirección de marca (alias) y que las respuestas le lleguen a su buzón real.
--   from_name    → nombre visible ("Juan · Onyx Trading Live")
--   from_alias   → alias @onyxtradinglive.com (ej. juan@…) para el remitente
--   reply_to     → su correo real donde recibe respuestas
alter table sales_reps add column if not exists from_name text;
alter table sales_reps add column if not exists from_alias text;
alter table sales_reps add column if not exists reply_to text;

alter table sales_applications enable row level security;

notify pgrst, 'reload schema';
