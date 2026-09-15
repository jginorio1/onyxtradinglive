-- ============================================================
-- CARRERAS v4 · Plazas del equipo de ventas (por comisión) dentro de Carreras.
-- sales_level marca la plaza como de ventas: 'director' | 'lead' | 'advisor'.
-- Una plaza con sales_level enruta la postulación TAMBIÉN al reclutamiento de
-- ventas (sales_applications), además de guardarla en Carreras.
-- Ejecutar DESPUÉS de careers_v1..v3.sql.
-- ============================================================

alter table job_openings add column if not exists sales_level text;
