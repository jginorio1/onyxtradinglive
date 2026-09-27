-- ============================================
-- Onyx Trading Live · Red de VENTAS v3
--   · Método de cobro del representante (stripe | usdt)
-- La billetera USDT se reutiliza del perfil (payout_usdt_trc20/erc20/network).
-- Ejecuta después de sales_v2.sql.
-- ============================================

alter table sales_reps add column if not exists payout_method text default 'stripe';  -- stripe | usdt

notify pgrst, 'reload schema';
