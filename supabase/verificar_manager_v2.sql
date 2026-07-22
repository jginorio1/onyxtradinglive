-- ============================================
-- Comprobar que manager_v2.sql se aplicó bien.
-- No cambia nada: solo mira y te dice qué encontró.
-- ============================================

select
  -- La tabla nueva del estado del día
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'manager_state')            as tabla_manager_state,

  -- Columnas que añadimos
  (select count(*) from information_schema.columns
     where table_name = 'manager_events' and column_name = 'meta')              as columna_meta,
  (select count(*) from information_schema.columns
     where table_name = 'trading_accounts' and column_name = 'firm_template')   as columna_firm_template,

  -- La fila de ajustes para las plantillas de prop firms
  (select count(*) from app_settings where key = 'prop_templates')              as ajuste_prop_templates,

  -- La capacidad nueva: bloqueo por noticias, solo en Elite
  (select count(*) from plans
     where id = 'elite' and capabilities ? 'manager_news')                      as capacidad_noticias_elite,

  -- RLS encendido en la tabla nueva
  (select count(*) from pg_policies
     where tablename = 'manager_state')                                         as politicas_manager_state;

-- Todos los números deben ser 1 (el último puede ser 1 o más).
-- Si alguno sale 0, vuelve a ejecutar supabase/manager_v2.sql entero.
