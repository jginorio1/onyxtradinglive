-- Onyx Academy v27 · Idioma del alumno para los correos de becas (bilingüe).
-- Guardamos el idioma con el que el alumno interactuó, para escribirle en el suyo.
alter table public.academy_scholarships     add column if not exists lang text not null default 'es';
alter table public.academy_scholarship_apps add column if not exists lang text not null default 'es';
