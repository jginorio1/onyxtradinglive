-- Rate limiting ligero para endpoints públicos (IA / captura de leads / formularios).
-- Una fila por petición aceptada; contamos filas recientes por (bucket, ip).
create table if not exists rate_hits (
  id bigserial primary key,
  bucket text not null,          -- p.ej. 'analyze', 'support_lead'
  ip text not null,              -- IP del visitante (x-forwarded-for)
  created_at timestamptz not null default now()
);

-- Índice para contar rápido las peticiones recientes de una IP en un bucket.
create index if not exists rate_hits_lookup_idx on rate_hits (bucket, ip, created_at desc);

-- Limpieza: borra lo más viejo que 1 día (la ventana de rate-limit es de minutos).
-- Se puede llamar desde un cron o dejar que el propio limitador lo haga de vez en cuando.
create index if not exists rate_hits_created_idx on rate_hits (created_at);
