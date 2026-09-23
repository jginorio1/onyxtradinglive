-- Academia OFICIAL "Onyx Bot Lab" (solo admin). Marca UNA academia (mentors)
-- como oficial: sale destacada en el directorio y solo el admin la administra.
alter table mentors add column if not exists is_official boolean default false;
comment on column mentors.is_official is 'true = academia oficial de Onyx Bot Lab (creada por el admin).';
-- Solo debe haber una oficial. Índice único parcial (permite varias false).
create unique index if not exists mentors_one_official on mentors ((is_official)) where is_official = true;
