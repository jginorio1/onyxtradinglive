-- Onyx Academy v4 · concesión automática de Onyx Guardian por perk de nivel.
-- Ejecutar tras academy_v3.sql.

-- Marca por usuario: tiene Guardian concedido por una compra de academia activa.
-- Se recalcula al comprar/cancelar. La capacidad efectiva de Guardian pasa a ser
-- (plan.capabilities.manager) OR (profiles.academy_guardian).
alter table public.profiles add column if not exists academy_guardian boolean not null default false;
