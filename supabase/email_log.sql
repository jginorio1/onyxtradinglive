-- Registro de correos que ENVÍA el sistema (bandeja de salida + por usuario).
-- Cada envío por Resend deja una fila aquí. Correr una vez. Idempotente.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text,
  kind text,                 -- billing | admin | support | challenge | ...
  status text default 'sent',-- sent | failed
  user_id uuid,              -- opcional
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists email_log_to on public.email_log (to_email, created_at desc);
create index if not exists email_log_at on public.email_log (created_at desc);

alter table public.email_log enable row level security;
