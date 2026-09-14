-- Onyx Academy v2 · secciones, clases en vivo, DMs y bucket de imágenes.
-- Ejecutar tras academy.sql, academy_pay.sql y academy_gamify.sql.

-- Agrupar lecciones por sección/tema dentro de un curso (como Skool).
alter table public.academy_lessons add column if not exists section text;

-- Sesiones en vivo (Zoom) programadas por el mentor.
create table if not exists public.academy_events (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references public.mentors(user_id) on delete cascade,
  title       text not null,
  description text,
  join_url    text,                       -- link de Zoom/Meet
  starts_at   timestamptz not null,
  duration_min int not null default 60,
  created_at  timestamptz not null default now()
);
create index if not exists academy_events_mentor on public.academy_events(mentor_id, starts_at);

-- Mensajes privados (DM) entre miembros de una comunidad.
create table if not exists public.academy_messages (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null,               -- comunidad
  from_id    uuid not null,
  to_id      uuid not null,
  body       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists academy_msg_pair on public.academy_messages(mentor_id, from_id, to_id, created_at);
create index if not exists academy_msg_inbox on public.academy_messages(mentor_id, to_id, read_at);

-- Bucket público para portadas/miniaturas subidas por el mentor.
insert into storage.buckets (id, name, public)
values ('academy', 'academy', true)
on conflict (id) do nothing;

-- Lectura pública del bucket + escritura de usuarios autenticados.
do $$
begin
  begin
    create policy "academy public read" on storage.objects
      for select using (bucket_id = 'academy');
  exception when duplicate_object then null; end;
  begin
    create policy "academy auth write" on storage.objects
      for insert with check (bucket_id = 'academy' and auth.role() = 'authenticated');
  exception when duplicate_object then null; end;
end $$;
