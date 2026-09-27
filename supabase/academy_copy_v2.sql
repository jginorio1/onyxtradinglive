-- ============================================================
-- Copy del mentor · v2 · consentimiento y aceptación de términos (legal).
-- El alumno acepta los riesgos antes de conectar; el mentor acepta sus
-- responsabilidades antes de ofrecer su copy. Guardamos la marca de tiempo.
-- ============================================================
alter table academy_copy_subs   add column if not exists consent_at timestamptz;
alter table academy_copy_offers  add column if not exists terms_accepted_at timestamptz;
