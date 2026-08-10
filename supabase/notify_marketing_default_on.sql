-- =====================================================================
--  "Novedades y ofertas" (notify_marketing) activado por defecto.
--  · Las cuentas NUEVAS nacen con el toggle encendido.
--  · Los usuarios que NUNCA lo tocaron (null) quedan encendidos.
--  · A quien lo apagó a propósito (false) NO se le toca.
-- =====================================================================

alter table profiles alter column notify_marketing set default true;
update profiles set notify_marketing = true where notify_marketing is null;
