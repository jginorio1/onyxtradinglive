-- ============================================================
-- Onyx Academy · v22 · Crear academia = función de pago
-- Un usuario en plan GRATIS puede ser ALUMNO de una o varias academias, pero NO
-- puede TENER (crear) su propia academia sin pagar. La capacidad "academy" queda
-- solo en los planes de pago (Pro/Elite/Black). Onyx gana por dos vías con cada
-- mentor: (1) su suscripción de plan y (2) la comisión por venta a sus alumnos.
-- Idempotente.
-- ============================================================

-- Quitar la capacidad de crear academia al plan Gratis.
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy": false}'::jsonb where id = 'free';

-- Asegurar que los planes de pago SÍ pueden crear academia.
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy": true}'::jsonb where id in ('pro', 'elite', 'black');
