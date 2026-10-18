-- ============================================================
-- Soporte robusto v1: clasificación IA + ruteo + escalamiento + estados
-- nuevos + lead source + métricas/CSAT. Idempotente (se puede correr varias
-- veces). Corre una sola vez en el SQL Editor de Supabase.
-- ============================================================

-- --- Clasificación / IA ---
alter table support_tickets add column if not exists lang       text;        -- idioma detectado del cliente (es, en, pt…)
alter table support_tickets add column if not exists sentiment  text;        -- positive | neutral | negative | angry
alter table support_tickets add column if not exists ai_summary text;        -- resumen de una línea que deja la IA
-- priority ya existe (low|normal|high); ahora admite también 'urgent' a nivel app.

-- --- Ruteo + escalamiento ---
alter table support_tickets add column if not exists escalation_level int not null default 1;   -- 1=N1, 2=N2, 3=supervisor
alter table support_tickets add column if not exists hold_until  timestamptz;                   -- para on_hold / pending programado

-- --- Lead source (de dónde vino) ---
alter table support_tickets add column if not exists source       text;   -- web | facebook | instagram | google | whatsapp | email | referral | direct | ads
alter table support_tickets add column if not exists utm_source   text;
alter table support_tickets add column if not exists utm_medium   text;
alter table support_tickets add column if not exists utm_campaign text;
alter table support_tickets add column if not exists landing      text;   -- página donde entró (path)

-- --- Métricas / ciclo de vida ---
alter table support_tickets add column if not exists first_response_at timestamptz;  -- primera respuesta de un HUMANO del equipo
alter table support_tickets add column if not exists resolved_at       timestamptz;
alter table support_tickets add column if not exists reopened_at       timestamptz;
alter table support_tickets add column if not exists reopen_count      int not null default 0;

-- --- CSAT (satisfacción del cliente al resolver) ---
alter table support_tickets add column if not exists csat         int;          -- 1..5
alter table support_tickets add column if not exists csat_comment text;
alter table support_tickets add column if not exists csat_at      timestamptz;
alter table support_tickets add column if not exists csat_token   text;         -- token para que el cliente califique por enlace

-- Índices para el tablero de métricas y el inbox
create index if not exists support_tickets_source_idx   on support_tickets (source, created_at desc);
create index if not exists support_tickets_resolved_idx on support_tickets (resolved_at desc);
create index if not exists support_tickets_escal_idx    on support_tickets (escalation_level, status);
create index if not exists support_tickets_csat_token_idx on support_tickets (csat_token);

-- Backfill suave: tickets ya resueltos sin resolved_at → usa updated_at.
update support_tickets set resolved_at = updated_at where status = 'resolved' and resolved_at is null;
