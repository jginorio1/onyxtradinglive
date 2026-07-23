-- ============================================
-- Onyx Trading Live · Soporte v2: leads (visitantes sin cuenta)
-- Ejecuta DESPUÉS de support_v1.sql, en Supabase → SQL Editor
-- ============================================

-- Un lead es un ticket de alguien que aún no tiene cuenta: solo tenemos su
-- correo. Por eso user_id pasa a ser opcional.
alter table support_tickets alter column user_id drop not null;
alter table support_tickets add column if not exists is_lead boolean not null default false;
alter table support_tickets add column if not exists name text;

notify pgrst, 'reload schema';
