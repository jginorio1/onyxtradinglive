-- ============================================================
-- Onyx Trading Live · NÓMINA v2 — Deducciones + recibo (bruto → neto)
--   · staff.deductions          → conceptos por empleado (override del global)
--   · staff_payments.gross/net  → bruto y neto del pago
--   · staff_payments.deductions → desglose aplicado (snapshot)
-- Ejecuta después de payroll_v1.sql.
-- ============================================================

alter table staff          add column if not exists deductions jsonb;
alter table staff_payments add column if not exists gross      numeric;
alter table staff_payments add column if not exists net        numeric;
alter table staff_payments add column if not exists deductions jsonb;

notify pgrst, 'reload schema';
