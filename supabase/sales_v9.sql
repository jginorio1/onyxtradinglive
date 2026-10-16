-- Ventas · robustez del webhook de cobros.
-- Cacheamos el "tier" (desempeño) del vendedor en su propia fila para que el
-- webhook de Stripe NO tenga que recalcular el scorecard (consulta pesada) en
-- cada pago. El tope de meses automático lee esta columna; un cron la refresca.
alter table sales_reps add column if not exists tier     text;          -- star | solid | risk (cacheado)
alter table sales_reps add column if not exists tier_at  timestamptz;   -- cuándo se calculó por última vez

notify pgrst, 'reload schema';
