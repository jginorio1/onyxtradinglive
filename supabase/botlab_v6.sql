-- Onyx Bot Lab v6 — hilo de correo y notas internas por lead (mini-CRM).
-- Cada fila es un mensaje ligado a una solicitud de servicio (lead).
--   kind = 'email'   → correo saliente enviado al lead desde el panel
--          'note'    → nota interna (el lead NO la ve)
--          'inbound' → respuesta del lead (si en el futuro se captura por webhook)
create table if not exists public.bot_lead_messages (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.bot_service_requests(id) on delete cascade,
  kind        text not null default 'email',   -- email | note | inbound
  subject     text,
  body        text not null,
  admin_email text,                            -- quién lo escribió (para auditoría)
  created_at  timestamptz not null default now()
);
create index if not exists bot_lead_msgs_lead on public.bot_lead_messages(lead_id, created_at);

alter table public.bot_lead_messages enable row level security;
-- Solo el service role (backend admin) accede; sin políticas públicas.
