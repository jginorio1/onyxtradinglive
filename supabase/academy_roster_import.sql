-- Importar la comunidad de un mentor a Onyx Academy (carga por el admin).
-- El admin sube la base del mentor (email + nombre opcional). Cada alumno:
--   · si YA tiene cuenta Onyx -> se inscribe de una vez a ese mentor (plan gratis).
--   · si NO tiene cuenta -> se deja en lista de espera; al registrarse con ese
--     email cae inscrito solo, sin que el admin vuelva a subir nada.
-- Guardamos también el nombre y el origen en la lista de espera para no perderlos.
alter table public.academy_waitlist add column if not exists name   text;
alter table public.academy_waitlist add column if not exists source text default 'import';

notify pgrst, 'reload schema';
