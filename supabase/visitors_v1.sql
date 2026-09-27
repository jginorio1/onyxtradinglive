-- Analítica de visitantes propia (privacy-first, sin cookies).
-- A cada visitante se le asigna un id ANÓNIMO = hash(IP + navegador + sal diaria).
-- No guarda IP, ni user-agent, ni nada personal: solo el hash irreversible.
--
--  · visitors    → una fila por persona (para deduplicar y separar nuevos/recurrentes).
--  · page_visits → un evento por página vista (para el feed, el gráfico y los tops).

-- Una fila por visitante único. first_seen decide "nuevo vs recurrente".
create table if not exists public.visitors (
  vid         text primary key,          -- hash anónimo del visitante
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  hits        integer     not null default 1,
  country     text
);
create index if not exists visitors_last_seen_idx  on public.visitors (last_seen);
create index if not exists visitors_first_seen_idx on public.visitors (first_seen);

-- Log de páginas vistas (para gráfico 24h, feed en vivo y tops). Se puede podar.
create table if not exists public.page_visits (
  id       bigserial primary key,
  vid      text        not null,
  path     text,
  ref      text,                          -- host de procedencia (google, instagram, directo…)
  country  text,
  ts       timestamptz not null default now()
);
create index if not exists page_visits_ts_idx  on public.page_visits (ts);
create index if not exists page_visits_vid_idx on public.page_visits (vid);
