-- Fecha límite de la disputa (para la cuenta regresiva y el auto-envío de respaldo).
alter table payment_evidence add column if not exists due_by timestamptz;
