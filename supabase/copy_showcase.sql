-- Tarjeta verificada para CUALQUIER usuario (no solo proveedores de Copy).
-- `showcase` = la cuenta tiene tarjeta/certificado PÚBLICO compartible, aunque NO
-- esté a la venta ni en el ranking de copia. La página pública /copy/t/[id] se
-- muestra si (listed=true OR showcase=true) y status='active'.
alter table strategy_providers add column if not exists showcase boolean not null default false;

-- Índice para la página pública (busca por listed/showcase activos).
create index if not exists idx_strategy_providers_public
  on strategy_providers (status) where (listed = true or showcase = true);
