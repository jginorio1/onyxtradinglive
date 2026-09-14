-- ============================================================
-- Onyx Trading Live · Red de VENTAS v6
--   Correo de trabajo del representante (buzón con tu dominio, p. ej. Zoho:
--   juan@onyxtradinglive.com). Se usa como remitente de los correos que el
--   vendedor manda a sus clientes (respuestas de tickets), con reply-to a él.
-- Ejecuta después de sales_v5.sql.
-- ============================================================

alter table sales_reps add column if not exists work_email text;

notify pgrst, 'reload schema';
