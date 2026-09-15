-- ============================================================
-- Onyx Trading Live · CARRERAS (plazas disponibles) v1
--   Página pública /carreras con las vacantes, configurable desde el panel.
--   Los candidatos se postulan con CV. Vive en el área Equipo del admin.
-- Ejecuta en Supabase SQL Editor.
-- ============================================================

create table if not exists job_openings (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  department   text not null default 'other',   -- dev | management | marketing | design | ops | sales | other
  location     text default 'Remoto',
  type         text default 'full',             -- full | part | contract | intern
  summary      text,                             -- 1-2 líneas para la tarjeta
  description  text,                             -- descripción completa (markdown básico)
  tags         jsonb default '[]'::jsonb,        -- ["React","Remoto",...]
  salary_range text,                             -- opcional: "$1500 - $2500"
  status       text not null default 'open',     -- open | closed | draft
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists job_openings_status_idx on job_openings (status, sort);

create table if not exists job_applications (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references job_openings(id) on delete set null,
  job_title    text,
  name         text not null,
  email        text not null,
  phone        text,
  country      text,
  message      text,
  resume_url   text,                             -- ruta en el bucket privado careers-cv
  status       text not null default 'new',      -- new | review | interview | hired | rejected
  created_at   timestamptz not null default now()
);
create index if not exists job_applications_job_idx on job_applications (job_id, created_at desc);

alter table job_openings     enable row level security;
alter table job_applications enable row level security;

-- Ajustes de la página (cabecera, activar, cómo postular).
insert into app_settings (key, value)
values ('careers', '{"enabled":true,"title":"Únete a Onyx","subtitle":"Estamos construyendo el futuro del trading. Mira nuestras plazas y postúlate.","title_en":"Join Onyx","subtitle_en":"We are building the future of trading. See our openings and apply.","apply_mode":"form"}'::jsonb)
on conflict (key) do nothing;

-- Bucket privado para los CV de candidatos.
insert into storage.buckets (id, name, public)
values ('careers-cv', 'careers-cv', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
