-- ============================================================
-- Onyx Bot Factory · Fase 4a — Magic number automático
-- Cada robot recibe un magic de 9 dígitos ÚNICO y no editable al crearse.
-- En MT4/MT5 el magic es un ENTERO (no admite letras); el texto va en el comment.
-- ============================================================
alter table public.factory_bots add column if not exists magic bigint;
create unique index if not exists factory_bots_magic_uniq on public.factory_bots(magic) where magic is not null;
