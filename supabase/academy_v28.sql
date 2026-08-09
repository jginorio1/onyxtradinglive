-- Onyx Academy v28 · Becas Fase 3: cupo/presupuesto por academia.
-- Tope de becas COMPLETAS activas que un mentor puede tener a la vez (0 = sin tope).
alter table public.mentors add column if not exists scholarship_cap int not null default 0;
