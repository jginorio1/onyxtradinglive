-- Registro de activaciones de los robots del constructor (candado /api/v1/activate).
-- Permite RASTREAR bots revendidos/filtrados: si `foreign_run` es true, la cuenta que
-- corre el bot NO es la del creador original. Es opcional: el candado funciona sin ella.
create table if not exists public.bot_activations (
  id          uuid primary key default gen_random_uuid(),
  build       text not null,            -- id del bot construido (huella)
  creator     text,                     -- user_id del creador original (huella)
  runner_user_id uuid,                  -- user_id de quien lo está corriendo (dueño de la clave)
  account     bigint,                   -- número de cuenta MT donde corre
  magic       bigint,
  foreign_run boolean default false,    -- true = lo corre alguien distinto al creador
  first_seen  timestamptz default now(),
  last_seen   timestamptz default now(),
  unique (build, account)
);

create index if not exists bot_activations_creator_idx on public.bot_activations (creator);
create index if not exists bot_activations_foreign_idx on public.bot_activations (foreign_run) where foreign_run = true;

alter table public.bot_activations enable row level security;
-- Solo el service role (backend) escribe/lee; sin políticas públicas.
