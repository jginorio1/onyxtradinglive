-- ============================================================
-- LIMPIEZA (Fase 5 · opcional) — retirar las tablas VIEJAS de comisiones
-- ------------------------------------------------------------
-- Tras unificar Vendedores + Embajadores en el libro único `comm_commissions`,
-- estas dos tablas ya NO las escribe ni las lee ningún código:
--     · sales_commissions   (motor viejo de Ventas)
--     · commissions         (motor viejo de Embajadores)
--
-- Academia (academy_reward_events) e "Invita y gana" (member_rewards) se
-- QUEDAN como están — NO se tocan aquí.
--
-- No hay usuarios en producción, así que no hay datos que conservar ni migrar.
-- Aun así se deja COMENTADO: descoméntalo solo cuando quieras borrarlas de
-- verdad. Es irreversible. Recomendado: hacer un backup antes.
-- ============================================================

-- -- Confirma primero que están vacías / sin uso:
-- select 'sales_commissions' as tabla, count(*) from sales_commissions
-- union all
-- select 'commissions', count(*) from commissions;

-- -- Cuando estés seguro, descomenta estas dos líneas:
-- drop table if exists sales_commissions cascade;
-- drop table if exists commissions cascade;

-- notify pgrst, 'reload schema';
