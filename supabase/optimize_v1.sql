-- Afinado de la base de datos. La app llama a esta función para que Postgres
-- recalcule estadísticas y las consultas sigan siendo rápidas al crecer.
-- Tolerante: si una tabla aún no existe, no rompe.
create or replace function public.optimize_maintenance()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  begin analyze public.trades; exception when others then null; end;
  begin analyze public.trading_accounts; exception when others then null; end;
  begin analyze public.profiles; exception when others then null; end;
  begin analyze public.support_tickets; exception when others then null; end;
  begin analyze public.support_messages; exception when others then null; end;
  begin analyze public.app_errors; exception when others then null; end;
  begin analyze public.telegram_log; exception when others then null; end;
end;
$$;

revoke all on function public.optimize_maintenance() from public;
