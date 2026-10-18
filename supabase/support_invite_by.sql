-- Soporte: registrar QUIÉN invitó a cada participante de un ticket.
-- Permite (1) el candado "el invitado no puede invitar de vuelta a quien lo invitó"
-- y (2) mostrar en la bandeja quién sumó a cada compañero.
-- Seguro de correr varias veces.
alter table if exists public.ticket_participants
  add column if not exists invited_by uuid references auth.users(id) on delete set null;

-- Permitir sender 'system' en los mensajes (línea visible neutra para el cliente
-- cuando se suma otra persona de soporte). Si hay un CHECK que restringe 'sender',
-- lo ampliamos; si no existe, no pasa nada.
do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'support_messages' and column_name = 'sender'
  ) then
    begin
      alter table public.support_messages drop constraint if exists support_messages_sender_check;
    exception when others then null;
    end;
  end if;
end $$;
