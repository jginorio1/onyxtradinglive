-- Plantillas de bot: recetas guardadas que el trader reutiliza para arrancar bots nuevos.
-- Igual que bots_built pero sin magic ni plataforma fija; es una base para clonar.
create table if not exists bot_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,                 -- nombre de la plantilla (ej: "Scalp oro Londres")
  spec        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table bot_templates enable row level security;
drop policy if exists "own bot templates" on bot_templates;
create policy "own bot templates" on bot_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_bot_templates_user on bot_templates(user_id);
