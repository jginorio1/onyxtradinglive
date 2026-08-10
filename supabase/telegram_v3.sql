-- ============================================
-- Onyx · Telegram v3 — informe semanal
-- Ejecuta este archivo completo en Supabase → SQL Editor. Seguro de repetir.
-- ============================================

-- Interruptor del informe semanal (apagado por defecto: es opt-in)
alter table profiles add column if not exists tg_weekly boolean not null default false;

-- Comprobación: debe devolver 1
select count(*) as columna_creada
from information_schema.columns
where table_name = 'profiles' and column_name = 'tg_weekly';

notify pgrst, 'reload schema';
