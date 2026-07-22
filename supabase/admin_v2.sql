-- ============================================================
-- Onyx · Panel v2: capacidades por plan (JSON) + roles de equipo
-- Ejecuta en Supabase → SQL Editor (proyecto aohupkoamqnmeyqduuxa). Seguro de re-ejecutar.
-- ============================================================

-- Capacidades configurables por plan (flexible: se añaden nuevas sin tocar la BD)
alter table plans add column if not exists capabilities jsonb not null default '{}'::jsonb;

-- Rol del administrador: owner | admin | support
alter table profiles add column if not exists role text;

-- Semilla de capacidades (solo si el plan aún no tiene)
update plans set capabilities = '{"history_days":30,"journal":false,"compare":false,"funding":false,"costs":true,"export":false,"reports":false,"telegram":false,"ea_risk":false}'::jsonb
  where id='free'  and capabilities = '{}'::jsonb;
update plans set capabilities = '{"history_days":0,"journal":true,"compare":true,"funding":true,"costs":true,"export":true,"reports":false,"telegram":false,"ea_risk":false}'::jsonb
  where id='pro'   and capabilities = '{}'::jsonb;
update plans set capabilities = '{"history_days":0,"journal":true,"compare":true,"funding":true,"costs":true,"export":true,"reports":true,"telegram":true,"ea_risk":true}'::jsonb
  where id='elite' and capabilities = '{}'::jsonb;

-- Marca al dueño (tú). Cambia el email si hace falta.
update profiles set role = 'owner', is_admin = true where email = 'jerryx35@gmail.com';

notify pgrst, 'reload schema';
