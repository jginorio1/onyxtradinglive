-- =====================================================================
-- Onyx Training · v1 — Academia INTERNA de empleados y vendedores.
-- Área de estudio con rutas, lecciones, exámenes, rendimiento académico y
-- certificados. Aislada de las academias de los mentores (esto NO toca ninguna
-- tabla academy_*). El acceso se activa/desactiva por persona (training_access).
-- Idempotente: se puede correr varias veces sin romper nada.
-- =====================================================================

-- --- RUTAS DE ESTUDIO -------------------------------------------------
-- Cada ruta es un "curso" con lecciones y un examen (banco de preguntas).
create table if not exists training_tracks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                      -- ej. 'conectar-ea'
  title_es text not null default '',
  title_en text not null default '',
  summary_es text default '',
  summary_en text default '',
  icon text default 'school',                     -- nombre para OnyxIcon
  sort int not null default 0,
  required_for text[] not null default '{}',      -- roles a los que aplica: vendedor|staff|support|instalador
  pass_score int not null default 80,             -- nota mínima para aprobar (0-100)
  max_attempts int not null default 3,            -- 0 = ilimitado
  exam_count int not null default 0,              -- nº de preguntas al azar (0 = todas)
  cert_months int not null default 0,             -- caducidad del certificado en meses (0 = no caduca)
  prereq_track_id uuid references training_tracks(id) on delete set null,
  gate_leads boolean not null default false,      -- si true, es requisito para recibir leads (gating)
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists training_tracks_sort_idx on training_tracks (sort);

-- --- LECCIONES --------------------------------------------------------
create table if not exists training_lessons (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references training_tracks(id) on delete cascade,
  title_es text not null default '',
  title_en text not null default '',
  body_es text default '',                        -- markdown / texto
  body_en text default '',
  video_url text,                                 -- opcional (embed)
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists training_lessons_track_idx on training_lessons (track_id, sort);

-- --- BANCO DE PREGUNTAS (examen por ruta) -----------------------------
-- options_es/en: arreglo JSON de textos. correct: índice (0-based) de la correcta.
create table if not exists training_questions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references training_tracks(id) on delete cascade,
  prompt_es text not null default '',
  prompt_en text not null default '',
  options_es jsonb not null default '[]'::jsonb,
  options_en jsonb not null default '[]'::jsonb,
  correct int not null default 0,
  explain_es text default '',
  explain_en text default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists training_questions_track_idx on training_questions (track_id, sort);

-- --- ACCESO (quién entra) --------------------------------------------
-- Una fila por persona. active controla el acceso (el interruptor del admin).
-- role: para saber qué rutas son obligatorias para esa persona.
create table if not exists training_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff',             -- vendedor | staff | support | instalador
  active boolean not null default true,
  source text default 'manual',                   -- manual | sales | staff (de dónde salió)
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id)
);
create index if not exists training_access_active_idx on training_access (active);

-- --- PROGRESO (lección vista) ----------------------------------------
create table if not exists training_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references training_lessons(id) on delete cascade,
  done boolean not null default true,
  done_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index if not exists training_progress_user_idx on training_progress (user_id);

-- --- INTENTOS DE EXAMEN ----------------------------------------------
create table if not exists training_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references training_tracks(id) on delete cascade,
  score int not null default 0,                   -- 0-100
  passed boolean not null default false,
  total int not null default 0,                   -- nº de preguntas
  correct int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists training_attempts_user_idx on training_attempts (user_id, track_id, created_at desc);

-- --- CERTIFICADOS (uno por persona+ruta; se renueva al reaprobar) -----
create table if not exists training_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references training_tracks(id) on delete cascade,
  score int not null default 0,
  code text,                                       -- folio público
  issued_at timestamptz not null default now(),
  expires_at timestamptz,                          -- null = no caduca
  unique (user_id, track_id)
);
create index if not exists training_certificates_expiry_idx on training_certificates (expires_at);

-- RLS: todo se sirve por el service role (supabaseAdmin) desde el backend.
alter table training_tracks       enable row level security;
alter table training_lessons      enable row level security;
alter table training_questions    enable row level security;
alter table training_access       enable row level security;
alter table training_progress     enable row level security;
alter table training_attempts     enable row level security;
alter table training_certificates enable row level security;

-- Ajustes del módulo (app_settings key 'training').
insert into app_settings (key, value)
values ('training', '{"enabled":true,"brand_name":"Onyx Academy · Formación interna","pass_score":80,"max_attempts":3,"remind_pending":true,"remind_cert_days":15,"auto_enroll_sales":true,"auto_enroll_staff":true,"gating_enabled":false}'::jsonb)
on conflict (key) do nothing;
