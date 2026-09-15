-- =====================================================================
-- Red de ventas · v8 — reclutamiento en cascada
-- Cada supervisor puede tener su enlace personal de reclutamiento; la
-- solicitud recuerda quién la trajo (sponsor) para colgarla en su rama.
-- =====================================================================

alter table sales_applications add column if not exists sponsor_rep_id uuid references sales_reps(id) on delete set null;
create index if not exists sales_apps_sponsor_idx on sales_applications (sponsor_rep_id);

notify pgrst, 'reload schema';
