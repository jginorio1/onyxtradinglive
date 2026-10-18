-- ============================================================
-- Ola 5 · Chat de equipo: mensajes urgentes + búsqueda.
-- Idempotente.
-- ============================================================

-- Marca de URGENTE en un mensaje (lo resalta y avisa a todos los miembros).
alter table if exists chat_messages add column if not exists urgent boolean not null default false;

-- Búsqueda por texto: índice trigram para ILIKE rápido sobre el cuerpo.
create extension if not exists pg_trgm;
create index if not exists chat_messages_body_trgm on chat_messages using gin (body gin_trgm_ops);
