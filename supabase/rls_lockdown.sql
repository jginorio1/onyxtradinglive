-- ============================================================
-- BLINDAJE RLS  ·  Auditoría de seguridad
--
-- Problema: la clave anónima de Supabase es PÚBLICA. Cualquier tabla SIN
-- Row Level Security (RLS) activado queda expuesta: se podría leer/escribir
-- directamente contra la API REST de Supabase, saltándose tu app.
--
-- Solución: activar RLS en TODAS las tablas. Onyx nunca lee datos desde el
-- navegador (solo login/2FA); todo pasa por el servidor con el ROL DE SERVICIO,
-- que IGNORA la RLS. Por eso activar RLS sin políticas = "nadie entra con la
-- clave anónima" y la app sigue funcionando exactamente igual.
--
-- Correr UNA vez en Supabase (SQL editor). Es idempotente y seguro.
-- Si en el futuro necesitas que el navegador lea alguna tabla directamente,
-- se le añade una política concreta (auth.uid() = user_id).
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'account_documents','admin_log','ambassador_payouts','ambassadors','api_keys',
    'app_errors','app_settings','cancellations','commissions','copy_commands',
    'copy_control_log','copy_links','copy_log','kb_articles','manager_commands',
    'manager_configs','manager_events','manager_state','manager_templates','open_positions',
    'payouts','plans','profiles','push_subscriptions','ref_clicks','referrals',
    'support_messages','support_tickets','telegram_log','ticket_participants',
    'trade_journal','trades','trading_accounts'
  ]
  loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security;', t);
    end if;
  end loop;
end $$;

-- Nota: NO añadimos "force row level security" para que el rol de servicio
-- (tu backend) siga teniendo acceso total, que es como funciona la app.
