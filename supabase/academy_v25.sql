-- Onyx Academy v25 · Programa de becas. Ejecutar tras academy_pay.sql.
-- Una beca concede acceso (completo) a un alcance (toda la academia, un nivel
-- o unos módulos) por un tiempo. Fase 1: cobertura completa. La parcial (%)
-- se guarda pero se aplicará como descuento en el checkout en una fase posterior.

create table if not exists public.academy_scholarships (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null,                       -- dueño de la academia (mentors.user_id)
  student_id   uuid,                                -- beneficiario (null si es un código sin canjear)
  kind         text not null default 'direct',      -- direct | code
  code         text,                                -- código canjeable (para kind='code')
  coverage     text not null default 'full',        -- full | partial
  percent      int,                                 -- % de descuento si coverage='partial' (1..100)
  scope        text not null default 'all',         -- all | modules
  modules      jsonb not null default '[]'::jsonb,  -- [module_id,...] si scope='modules'
  product_id   uuid,                                -- nivel de referencia (para etiqueta/valor)
  reason       text default 'other',                -- low_income | raffle | merit | other
  seats        int not null default 1,              -- plazas totales (para code)
  used         int not null default 0,              -- canjes usados (para code)
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,                         -- null = de por vida
  status       text not null default 'active',      -- active | expired | revoked
  source_code  uuid,                                -- si nació al canjear un código, el id de ese código
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists academy_sch_mentor  on public.academy_scholarships(mentor_id, status);
create index if not exists academy_sch_student on public.academy_scholarships(student_id, status);
create unique index if not exists academy_sch_code
  on public.academy_scholarships(mentor_id, code) where code is not null;

-- ¿Permitir becas por academia? (control del dueño de la plataforma; por defecto sí).
alter table public.mentors add column if not exists scholarships_enabled boolean not null default true;
