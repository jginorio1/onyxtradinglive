-- ============================================
-- Onyx Trading Live · Diagnóstico: registro de errores
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Cada error del servidor aterriza aquí, con una explicación en lenguaje claro.
create table if not exists app_errors (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,          -- de dónde vino: ea_sync | support_ai | mail | telegram | ...
  code        text,                   -- HTTP 404, 308, timeout, etc. (si aplica)
  message     text not null,          -- el error técnico
  hint        text,                   -- explicación/qué hacer, en claro
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists app_errors_time_idx on app_errors (created_at desc);
create index if not exists app_errors_source_idx on app_errors (source, created_at desc);

notify pgrst, 'reload schema';
