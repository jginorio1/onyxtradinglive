-- Soporte: nombre del visitante + país/ciudad (aproximados por IP vía Vercel).
-- Se capturan al crear el lead/ticket. Todo es opcional y tolerante: si no corres
-- esto, el chat sigue funcionando; solo no verás nombre/origen en columna propia
-- (el origen igual aparece en la nota de apertura del ticket).
alter table support_tickets add column if not exists name    text;
alter table support_tickets add column if not exists country  text;   -- ISO-2: MX, CO, PR…
alter table support_tickets add column if not exists city     text;

notify pgrst, 'reload schema';
