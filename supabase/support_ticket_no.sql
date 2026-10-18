-- ============================================================
-- Número correlativo de ticket (#1001, #1002…) para comunicación humana.
-- El enlace sigue usando el UUID por detrás; el número es solo para mostrar.
-- Idempotente: se puede correr varias veces.
-- ============================================================

-- Secuencia que arranca en 1001 (no revela que "solo llevas 7 tickets").
create sequence if not exists support_ticket_no_seq start 1001;

-- Columna del número. La rellenamos abajo; luego le ponemos el default.
alter table if exists support_tickets add column if not exists ticket_no bigint;

-- Rellenar los tickets existentes que aún no tienen número, por orden de creación
-- (los más antiguos reciben los números más bajos). Solo asigna a los que faltan.
do $$
declare r record;
begin
  for r in select id from support_tickets where ticket_no is null order by created_at asc, id asc loop
    update support_tickets set ticket_no = nextval('support_ticket_no_seq') where id = r.id;
  end loop;
end $$;

-- A partir de ahora, cada ticket nuevo recibe su número automáticamente.
alter table if exists support_tickets alter column ticket_no set default nextval('support_ticket_no_seq');

-- Único e indexado (para buscar por número rápido).
create unique index if not exists support_tickets_ticket_no_idx on support_tickets (ticket_no);
