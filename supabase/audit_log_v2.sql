-- ============================================================
-- Auditoría v2 — registro de actividad más robusto.
-- Añade a admin_log el contexto de CADA cambio: IP, dispositivo (user-agent)
-- y área del panel. Así cada entrada responde: quién, qué día, qué hora, desde
-- dónde y qué exactamente (el meta ya guarda el antes→después).
-- Tolerante: si las columnas ya existen, no hace nada.
-- ============================================================

alter table public.admin_log
  add column if not exists ip         text,
  add column if not exists user_agent text,
  add column if not exists area       text;

-- Índices para filtrar/paginar rápido el historial completo.
create index if not exists idx_admin_log_email   on public.admin_log (admin_email);
create index if not exists idx_admin_log_action  on public.admin_log (action);
create index if not exists idx_admin_log_created on public.admin_log (created_at desc);
