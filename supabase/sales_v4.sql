-- ============================================
-- Onyx Trading Live · Red de VENTAS v4
--   · Currículum (CV) adjunto en las solicitudes
--   · Bucket de Storage para los CV
-- Ejecuta después de sales_v3.sql.
-- ============================================

alter table sales_applications add column if not exists resume_url text;

-- Bucket para los currículums (privado: se abre con enlace firmado desde el admin).
insert into storage.buckets (id, name, public)
values ('sales-cv', 'sales-cv', false)
on conflict (id) do nothing;

-- Los nombres de las posiciones (Director/Líder/Asesor…) se guardan dentro del
-- ajuste 'sales' (JSON level_names) — no requiere columna nueva.

notify pgrst, 'reload schema';
