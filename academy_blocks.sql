-- ============================================================
-- Onyx Trading Live · Bloqueo de usuarios en la comunidad (Apple 1.2)
-- Un miembro puede bloquear a otro: deja de ver sus publicaciones,
-- comentarios y mensajes, y no puede escribirle. Es reversible.
-- Correr una vez en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.academy_blocks (
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- Búsquedas rápidas por quién bloqueó y por quién fue bloqueado.
create index if not exists academy_blocks_blocker_idx on public.academy_blocks (blocker_id);
create index if not exists academy_blocks_blocked_idx on public.academy_blocks (blocked_id);

-- El acceso va por la clave de servicio (supabaseAdmin) desde el backend, igual
-- que el resto de tablas de la academia. Dejamos RLS activado sin políticas
-- públicas para que el cliente no la lea directamente.
alter table public.academy_blocks enable row level security;
