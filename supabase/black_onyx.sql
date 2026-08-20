-- ============================================================
-- Onyx · Plan tope "Black Onyx" (high-ticket, TODO ilimitado)
-- Ejecuta en Supabase → SQL Editor. Seguro de re-ejecutar.
--
-- Diferencia con Elite: el copy trading es ILIMITADO.
--   Convención: copy_slaves = 0 y copy_masters = 0 significan "sin tope".
-- El precio ($119) y el Price ID de Stripe los ajustas en Admin → Planes.
-- ============================================================

insert into plans (id, name, name_en, price_month, price_year, max_accounts,
                   features, features_en, badge, badge_en, capabilities, active, sort)
values (
  'black', 'Black Onyx', 'Black Onyx', 119, 1190, 999,
  '["Todo ilimitado","Cuentas MT ilimitadas","Copy trading ilimitado (masters y esclavas)","Onyx Guardian completo","Telegram y reportes","Soporte prioritario"]'::jsonb,
  '["Everything unlimited","Unlimited MT accounts","Unlimited copy trading (masters & slaves)","Full Onyx Guardian","Telegram & reports","Priority support"]'::jsonb,
  'High-ticket', 'High-ticket',
  '{"journal":true,"compare":true,"funding":true,"costs":true,"export":true,"reports":true,"telegram":true,"manager":true,"manager_advanced":true,"manager_news":true,"copy":true,"copy_slaves":0,"copy_masters":0,"history_days":0}'::jsonb,
  true, 3
)
on conflict (id) do nothing;

-- Descripción corta (columnas del seed bilingüe), por si existen esas columnas.
update plans set
  desc_es = coalesce(nullif(desc_es, ''), 'Sin límites. El plan definitivo.'),
  desc_en = coalesce(nullif(desc_en, ''), 'No limits. The ultimate plan.')
where id = 'black';

notify pgrst, 'reload schema';
