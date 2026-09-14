-- Plan pendiente de compra, atado a la cuenta (a prueba de dispositivos).
-- Cuando un usuario elige un plan de pago y se registra, guardamos aquí su plan.
-- Tras confirmar el email y el onboarding, lo llevamos al checkout de ese plan
-- aunque el correo se haya abierto en otro navegador/dispositivo. Se limpia solo
-- en cuanto lo mandamos al checkout.
alter table public.profiles add column if not exists pending_plan text;
alter table public.profiles add column if not exists pending_plan_annual boolean not null default false;
