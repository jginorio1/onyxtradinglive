-- Prueba de pago con caducidad ("cortesía" para embajadores/influencers).
-- El dueño concede un plan de pago por N días sin tarjeta. Al vencer, la cuenta
-- vuelve a Free sola. Si el usuario paga con tarjeta, su suscripción real manda.
alter table public.profiles add column if not exists comp_plan text;            -- plan concedido (pro/elite/black)
alter table public.profiles add column if not exists comp_until timestamptz;     -- fin de la prueba
alter table public.profiles add column if not exists comp_warned boolean not null default false;      -- ya se envió el email "por vencer"
alter table public.profiles add column if not exists comp_expired_seen boolean not null default false; -- ya vio el popup "expiró"
create index if not exists profiles_comp_until_idx on public.profiles (comp_until) where comp_until is not null;
