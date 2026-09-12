-- Registro de envíos de Telegram.
-- Cada vez que el bot manda un mensaje, se guarda una fila aquí.
-- Sirve para las métricas del panel (Módulos): enviados, /estado, fallidos,
-- informes semanales. Sin esta tabla, esas métricas salen en 0 (no rompe nada).

create table if not exists public.telegram_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  kind       text not null default 'message',   -- blocks|limits|manager|funding|daily|offline|goal|weekly|status|message
  ok         boolean not null default true,      -- ¿lo aceptó Telegram?
  error      text,                                -- motivo si falló
  created_at timestamptz not null default now()
);

create index if not exists telegram_log_created_idx on public.telegram_log (created_at desc);
create index if not exists telegram_log_kind_idx    on public.telegram_log (kind);

-- Solo el servidor (service role) escribe/lee. Sin políticas para usuarios.
alter table public.telegram_log enable row level security;
