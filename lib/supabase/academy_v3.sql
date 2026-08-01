-- Onyx Academy v3 · traders verificados + perks de nivel (Copy/Guardian).
-- Ejecutar tras academy_v2.sql.

-- Opt-in: el usuario decide mostrar su track record real en las academias.
alter table public.profiles add column if not exists academy_share_stats boolean not null default false;

-- Extras que incluye un nivel además de las aulas (ej. copy trading, Guardian).
-- Formato: {"copy": true, "guardian": true}. No ejecuta nada por sí solo:
-- solo se muestra al alumno y el mentor gestiona el acceso desde su lista.
alter table public.academy_products add column if not exists perks jsonb not null default '{}'::jsonb;
