-- Constructor de bots: "recetas" (spec) que el trader arma por campos y nombra a su gusto.
-- Guarda el spec completo en JSON; de aqui se genera el resumen, el .set de MT5 y (fase 2) el EA.
create table if not exists bots_built (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,                 -- nombre propio del bot (lo elige el trader)
  platform    text not null default 'mt5',   -- mt5 | mt4 | ctrader
  magic       bigint,                        -- magic number del bot (para verlo en "Mis robots")
  spec        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table bots_built enable row level security;
drop policy if exists "own built bots" on bots_built;
create policy "own built bots" on bots_built for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_bots_built_user on bots_built(user_id);
