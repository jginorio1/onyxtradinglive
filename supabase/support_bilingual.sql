-- ============================================================
-- Soporte bilingüe · columnas para traducción automática del chat de soporte.
-- Seguro de correr varias veces (IF NOT EXISTS). El código es tolerante: si no
-- corres esto, el soporte sigue funcionando en un solo idioma.
--
--   · support_messages.meta  : JSON con {lang, altLang, alt} — guarda, junto al
--     texto original (body), su versión traducida (la contraparte en el otro
--     idioma). Así el empleado ve ambas versiones y el cliente recibe la suya.
--   · support_tickets.client_lang : idioma detectado del cliente (ISO 639-1), para
--     no re-detectarlo en cada respuesta.
--   · support_tickets.agent_typing_at : sello de "el agente está escribiendo"
--     (ya usado por el indicador en el widget; aquí por si falta la columna).
-- ============================================================

alter table if exists public.support_messages
  add column if not exists meta jsonb;

alter table if exists public.support_tickets
  add column if not exists client_lang text;

alter table if exists public.support_tickets
  add column if not exists agent_typing_at timestamptz;

-- Idioma principal del empleado de soporte: se guarda en app_settings bajo la
-- clave 'support_agent_lang' (p. ej. "es"). No requiere columna propia.
