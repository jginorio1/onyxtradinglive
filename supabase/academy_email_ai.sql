-- ============================================================
-- Academy: interruptor por-mentor para que la IA personalice (ligero) sus correos
-- automáticos manteniendo su marca. Idempotente.
-- ============================================================
alter table if exists mentors add column if not exists email_ai boolean not null default false;
