-- ==================================================================
-- Onyx Trading Live · SETUP COMPLETO DE BASE DE DATOS (proyecto NUEVO)
-- Supabase → SQL Editor → pega TODO → Run.  Idempotente.
-- Orden: BASE primero (schema, planes, cuentas), luego cada familia
--        en orden NUMÉRICO (v2 antes que v10).
-- Lleva un bloque PREFLIGHT que asegura las columnas base de 'profiles'
-- para que el orden NO cause "column ... does not exist".
-- Si aún se detiene por una tabla de otra familia, pulsa Run otra vez:
-- las tablas base ya existen y la 2ª pasada termina limpio.
-- ==================================================================


-- ===== schema.sql (base) =====

-- ============================================================
-- Onyx Trading Live · esquema de base de datos (Supabase / Postgres)
-- Pega esto en Supabase → SQL Editor → Run
-- ============================================================

create extension if not exists "uuid-ossp";

-- Perfiles (extiende auth.users de Supabase Auth)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free',              -- free | pro | elite
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,                        -- active | trialing | past_due | canceled
  created_at timestamptz default now()
);

-- API keys que usa el conector EA (MT4/MT5)
create table if not exists api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null unique,
  label text,
  revoked boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- Cuentas de trading conectadas
create table if not exists trading_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  login bigint not null,
  broker text, server text, name text, currency text,
  leverage int, platform text default 'MT5',
  balance numeric, equity numeric,
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, login, server)
);

-- Operaciones cerradas (idempotente por ticket)
create table if not exists trades (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references trading_accounts(id) on delete cascade,
  ticket bigint not null,
  symbol text, side text, volume numeric,
  open_time timestamptz, open_price numeric,
  close_time timestamptz, close_price numeric,
  profit numeric, commission numeric, swap numeric, net_profit numeric,
  created_at timestamptz default now(),
  unique (account_id, ticket)
);

-- Posiciones abiertas (estado actual; se reemplaza en cada sync)
create table if not exists open_positions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references trading_accounts(id) on delete cascade,
  ticket bigint not null,
  symbol text, side text, volume numeric,
  open_time timestamptz, open_price numeric,
  sl numeric, tp numeric, profit numeric,
  updated_at timestamptz default now(),
  unique (account_id, ticket)
);

create index if not exists idx_trades_account on trades(account_id, close_time);
create index if not exists idx_accounts_user  on trading_accounts(user_id);

-- ============================================================
-- Seguridad a nivel de fila (RLS): cada usuario solo ve lo suyo.
-- El endpoint /v1/sync usa la service_role key y salta el RLS.
-- ============================================================
alter table profiles          enable row level security;
alter table api_keys          enable row level security;
alter table trading_accounts  enable row level security;
alter table trades            enable row level security;
alter table open_positions    enable row level security;

create policy "own profile"   on profiles         for select using (auth.uid() = id);
create policy "own keys"      on api_keys         for all    using (auth.uid() = user_id);
create policy "own accounts"  on trading_accounts for select using (auth.uid() = user_id);
create policy "own trades"    on trades           for select using (
  account_id in (select id from trading_accounts where user_id = auth.uid()));
create policy "own positions" on open_positions   for select using (
  account_id in (select id from trading_accounts where user_id = auth.uid()));

-- Crear perfil automaticamente al registrarse un usuario
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ==================================================================
-- PREFLIGHT (una sola vez): garantiza las columnas base que las
-- migraciones incrementales dan por hechas. Con esto el ORDEN deja
-- de importar para el error "column ... does not exist" — la causa
-- de casi todos los fallos al montar la base de cero.
-- Todo es "if not exists": seguro de re-ejecutar, no pisa datos.
-- ==================================================================
do $$ begin
  if to_regclass('public.profiles') is not null then
    alter table profiles add column if not exists is_admin         boolean not null default false;
    alter table profiles add column if not exists role             text;
    alter table profiles add column if not exists email            text;
    alter table profiles add column if not exists banned           boolean not null default false;
    alter table profiles add column if not exists full_name        text;
    alter table profiles add column if not exists notify_marketing boolean not null default false;
  end if;
end $$;


-- ===== profiles_fix.sql (base) =====

-- ============================================
-- Onyx · Arreglo: perfiles que faltan
-- ============================================
-- Problema: el disparador que crea el perfil solo actua al registrarse.
-- Las cuentas creadas antes (o si el disparador fallo) se quedaron sin fila
-- en 'profiles', y entonces TODO cae al valor por defecto: plan free.
--
-- Ejecuta este archivo en Supabase → SQL Editor.

-- 1) Crear la fila de perfil de cualquier usuario que no la tenga
insert into profiles (id, email, plan)
select u.id, u.email, 'free'
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;

-- 2) Rellenar el correo si quedo vacio en algun perfil
update profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

-- 3) Asegurar que el disparador existe para los registros futuros
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, plan)
  values (new.id, new.email, 'free')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 4) Devolverte el rol de owner (por si tambien se perdio)
update profiles set is_admin = true, role = 'owner' where email = 'jerryx35@gmail.com';

-- Comprueba el resultado:
select id, email, plan, is_admin, role from profiles;

notify pgrst, 'reload schema';


-- ===== account_v1.sql (base) =====

-- ============================================
-- Onyx Trading Live · Entrega 1: Mi cuenta
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Datos de perfil que el usuario puede editar
alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists timezone text default 'UTC';
alter table profiles add column if not exists lang text default 'es';

-- Preferencias de notificaciones
alter table profiles add column if not exists notify_email boolean not null default true;
alter table profiles add column if not exists notify_weekly boolean not null default true;
alter table profiles add column if not exists notify_funding boolean not null default true;
alter table profiles add column if not exists notify_marketing boolean not null default false;

-- Motivo de cancelación (lo usaremos en la entrega de retención)
alter table profiles add column if not exists cancel_reason text;
alter table profiles add column if not exists canceled_at timestamptz;

notify pgrst, 'reload schema';


-- ===== admin.sql (base) =====

-- ============================================================
-- Onyx Trading Live · MIGRACIÓN del panel súper-admin
-- Pega esto en Supabase → SQL Editor → Run
-- (Es seguro ejecutarlo aunque ya tengas datos: solo añade cosas.)
-- ============================================================

-- 1) Nuevos campos de control en profiles
alter table profiles add column if not exists is_admin  boolean not null default false;
alter table profiles add column if not exists banned    boolean not null default false;
alter table profiles add column if not exists full_name text;

-- 2) Tabla de PLANES (editable desde el panel de admin)
create table if not exists plans (
  id           text primary key,          -- free | pro | elite | (los que crees)
  name         text not null,
  price_month  numeric not null default 0,
  price_year   numeric not null default 0,
  stripe_price_id       text,             -- price_... de Stripe (mensual)
  stripe_price_id_year  text,             -- price_... de Stripe (anual, opcional)
  max_accounts int not null default 1,
  features     jsonb not null default '[]'::jsonb,
  badge        text,                      -- ej. "Más popular"
  active       boolean not null default true,
  sort         int not null default 0,
  updated_at   timestamptz default now()
);

-- Semilla inicial (no pisa lo que ya exista)
insert into plans (id, name, price_month, price_year, max_accounts, features, badge, active, sort) values
  ('free',  'Free',  0,   0,   1,   '["1 cuenta MT","Estadísticas básicas","30 días de historial"]',                                   null,          true, 0),
  ('pro',   'Pro',   19,  190, 5,   '["5 cuentas MT","Todas las estadísticas","Historial ilimitado","Calendario y gráficas","Reglas de fondeo"]', 'Más popular', true, 1),
  ('elite', 'Elite', 39,  390, 999, '["Cuentas ilimitadas","Todo lo de Pro","Informes automáticos","Alertas por Telegram","Soporte prioritario"]', null,          true, 2)
on conflict (id) do nothing;

-- 3) Registro de acciones del admin (auditoría)
create table if not exists admin_log (
  id          uuid primary key default uuid_generate_v4(),
  admin_email text,
  action      text,
  target      text,
  meta        jsonb,
  created_at  timestamptz default now()
);

-- 4) RLS
alter table plans     enable row level security;
alter table admin_log enable row level security;

-- Cualquiera puede LEER los planes activos (para la página de precios).
drop policy if exists "plans public read" on plans;
create policy "plans public read" on plans for select using (active = true);

-- Escrituras de plans y todo admin_log: solo la service_role (el backend del panel).
-- La service_role salta RLS, así que no hacen falta políticas de escritura aquí.

create index if not exists idx_admin_log_created on admin_log(created_at desc);


-- ===== admin_v2.sql (base) =====

-- ============================================================
-- Onyx · Panel v2: capacidades por plan (JSON) + roles de equipo
-- Ejecuta en Supabase → SQL Editor (proyecto aohupkoamqnmeyqduuxa). Seguro de re-ejecutar.
-- ============================================================

-- Capacidades configurables por plan (flexible: se añaden nuevas sin tocar la BD)
alter table plans add column if not exists capabilities jsonb not null default '{}'::jsonb;

-- Rol del administrador: owner | admin | support
alter table profiles add column if not exists role text;

-- Semilla de capacidades (solo si el plan aún no tiene)
update plans set capabilities = '{"history_days":30,"journal":false,"compare":false,"funding":false,"costs":true,"export":false,"reports":false,"telegram":false,"ea_risk":false}'::jsonb
  where id='free'  and capabilities = '{}'::jsonb;
update plans set capabilities = '{"history_days":0,"journal":true,"compare":true,"funding":true,"costs":true,"export":true,"reports":false,"telegram":false,"ea_risk":false}'::jsonb
  where id='pro'   and capabilities = '{}'::jsonb;
update plans set capabilities = '{"history_days":0,"journal":true,"compare":true,"funding":true,"costs":true,"export":true,"reports":true,"telegram":true,"ea_risk":true}'::jsonb
  where id='elite' and capabilities = '{}'::jsonb;

-- Marca al dueño (tú). Cambia el email si hace falta.
update profiles set role = 'owner', is_admin = true where email = 'jerryx35@gmail.com';

notify pgrst, 'reload schema';


-- ===== plans_bilingual.sql (base) =====

-- ============================================================
-- Onyx · Planes BILINGÜES (ES/EN)
-- Ejecuta en Supabase → SQL Editor (proyecto aohupkoamqnmeyqduuxa)
-- Seguro de re-ejecutar: solo añade columnas y rellena si están vacías.
-- ============================================================

-- Campos en inglés + descripción corta en ambos idiomas
alter table plans add column if not exists name_en     text;
alter table plans add column if not exists desc_es     text;
alter table plans add column if not exists desc_en     text;
alter table plans add column if not exists features_en jsonb not null default '[]'::jsonb;
alter table plans add column if not exists badge_en    text;

-- Rellenar inglés de los 3 planes base (solo si están vacíos)
update plans set
  name_en     = coalesce(nullif(name_en, ''), 'Free'),
  desc_es     = coalesce(nullif(desc_es, ''), 'Empieza a registrar tu trading'),
  desc_en     = coalesce(nullif(desc_en, ''), 'Start tracking your trading'),
  badge_en    = coalesce(badge_en, badge),
  features_en = case when features_en = '[]'::jsonb
                     then '["1 MT account","Basic stats","30 days of history"]'::jsonb
                     else features_en end
where id = 'free';

update plans set
  name_en     = coalesce(nullif(name_en, ''), 'Pro'),
  desc_es     = coalesce(nullif(desc_es, ''), 'Todo lo necesario para mejorar'),
  desc_en     = coalesce(nullif(desc_en, ''), 'Everything you need to improve'),
  badge_en    = coalesce(nullif(badge_en, ''), 'Most popular'),
  features_en = case when features_en = '[]'::jsonb
                     then '["5 MT accounts","All stats","Unlimited history","Calendar & charts","Prop-firm rules"]'::jsonb
                     else features_en end
where id = 'pro';

update plans set
  name_en     = coalesce(nullif(name_en, ''), 'Elite'),
  desc_es     = coalesce(nullif(desc_es, ''), 'Escala tu operativa'),
  desc_en     = coalesce(nullif(desc_en, ''), 'Scale your trading'),
  badge_en    = coalesce(badge_en, badge),
  features_en = case when features_en = '[]'::jsonb
                     then '["Unlimited accounts","Everything in Pro","Automatic reports","Telegram alerts","Priority support"]'::jsonb
                     else features_en end
where id = 'elite';

-- Refrescar la caché de PostgREST
notify pgrst, 'reload schema';


-- ===== plans_reseed.sql (base) =====

-- =====================================================================
--  Onyx Trading Live · Re-seed de PLANES
--  Úsalo si la página de precios sale VACÍA (la tabla `plans` no tiene
--  filas activas). Pégalo en Supabase → SQL Editor → Run.
--
--  · Crea los 3 planes base si no existen.
--  · Si ya existen, NO pisa tus precios/textos: solo se asegura de que
--    queden ACTIVOS (active = true) para que se vean en /pricing.
--  · Al final reactiva cualquier plan que estuviera desactivado.
-- =====================================================================

insert into plans (id, name, name_en, price_month, price_year, max_accounts, features, features_en, badge, badge_en, active, sort)
values
  ('free',  'Free',  'Free',  0,   0,   1,
    '["1 cuenta conectada","Estadísticas básicas","30 días de historial"]',
    '["1 connected account","Basic stats","30 days of history"]',
    null, null, true, 0),
  ('pro',   'Pro',   'Pro',   19,  190, 5,
    '["5 cuentas conectadas","Todas las estadísticas","Historial ilimitado","Calendario y gráficas","Reglas de fondeo"]',
    '["5 connected accounts","All stats","Unlimited history","Calendar & charts","Prop-firm rules"]',
    'Más popular', 'Most popular', true, 1),
  ('elite', 'Elite', 'Elite', 39,  390, 999,
    '["Cuentas ilimitadas","Todo lo de Pro","Informes automáticos","Alertas por Telegram","Soporte prioritario"]',
    '["Unlimited accounts","Everything in Pro","Automatic reports","Telegram alerts","Priority support"]',
    null, null, true, 2)
on conflict (id) do update
  set active = true;   -- si ya existe, solo lo reactiva (no toca tus precios/textos)

-- Por si acaso, reactiva TODOS los planes que estuvieran ocultos:
update plans set active = true where active is distinct from true;

-- Comprueba el resultado:
select id, name, price_month, price_year, active, sort from plans order by sort;


-- ===== black_onyx.sql (base) =====

-- ============================================================
-- Onyx · Plan tope "Black Onyx" (high-ticket, TODO ilimitado)
-- Ejecuta en Supabase → SQL Editor. Seguro de re-ejecutar.
--
-- Diferencia con Elite: el copy trading es ILIMITADO.
--   Convención: copy_slaves = 0 y copy_masters = 0 significan "sin tope".
-- El precio ($119) y el Price ID de Stripe los ajustas en Admin → Planes.
-- ============================================================

insert into plans (id, name, name_en, price_month, price_year, max_accounts,
                   features, features_en, badge, badge_en, capabilities, active, sort)
values (
  'black', 'Black Onyx', 'Black Onyx', 119, 1190, 999,
  '["Todo ilimitado","Cuentas MT ilimitadas","Copy trading ilimitado (masters y esclavas)","Onyx Guardian completo","Telegram y reportes","Soporte prioritario"]'::jsonb,
  '["Everything unlimited","Unlimited MT accounts","Unlimited copy trading (masters & slaves)","Full Onyx Guardian","Telegram & reports","Priority support"]'::jsonb,
  'High-ticket', 'High-ticket',
  '{"journal":true,"compare":true,"funding":true,"costs":true,"export":true,"reports":true,"telegram":true,"manager":true,"manager_advanced":true,"manager_news":true,"copy":true,"copy_slaves":0,"copy_masters":0,"history_days":0}'::jsonb,
  true, 3
)
on conflict (id) do nothing;

-- Descripción corta (columnas del seed bilingüe), por si existen esas columnas.
update plans set
  desc_es = coalesce(nullif(desc_es, ''), 'Sin límites. El plan definitivo.'),
  desc_en = coalesce(nullif(desc_en, ''), 'No limits. The ultimate plan.')
where id = 'black';

notify pgrst, 'reload schema';


-- ===== keys_v2.sql (base) =====

-- ============================================
-- Onyx Trading Live · Claves atadas a la cuenta
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Cada clave API pertenece a UNA cuenta de trading
alter table api_keys add column if not exists account_login bigint;   -- se ata sola en el primer sync
alter table api_keys add column if not exists broker text;            -- FTMO, The5ers, Axi, ...
alter table api_keys add column if not exists acc_type text;          -- challenge | funded | own | demo
alter table api_keys add column if not exists acc_size numeric;       -- tamaño de la cuenta fondeada
alter table api_keys add column if not exists currency text default 'USD';

-- Datos de la cuenta de trading (por si el usuario los declara antes del primer sync)
alter table trading_accounts add column if not exists acc_size numeric;

-- Un mismo número de cuenta no puede tener dos claves activas del mismo usuario
create unique index if not exists api_keys_user_login_idx
  on api_keys (user_id, account_login)
  where account_login is not null and revoked = false;

notify pgrst, 'reload schema';


-- ===== academy.sql =====

-- Onyx Academy (estilo Skool) · comunidad + cursos. Ejecutar en el SQL Editor de Supabase.
-- Un mentor tiene UNA academia (mentors). Publica módulos y lecciones (con vídeo).
-- Los alumnos se inscriben por el código del mentor y ven el contenido + comunidad.

create table if not exists public.mentors (
  user_id      uuid primary key,
  code         text unique not null,               -- código/slug para el enlace de inscripción
  academy_name text not null default 'Mi academia',
  tagline      text,
  about        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.academy_modules (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references public.mentors(user_id) on delete cascade,
  title       text not null,
  description text,
  position    int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists academy_modules_mentor on public.academy_modules(mentor_id, position);

create table if not exists public.academy_lessons (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.academy_modules(id) on delete cascade,
  mentor_id   uuid not null,
  title       text not null,
  video_url   text,                                -- YouTube/Vimeo/mp4
  content     text,                                -- notas / texto de la lección
  resources   jsonb not null default '[]'::jsonb,  -- [{label,url}]
  position    int not null default 0,
  is_free     boolean not null default false,      -- preview gratis sin inscribirse
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists academy_lessons_module on public.academy_lessons(module_id, position);

create table if not exists public.academy_enrollments (
  mentor_id   uuid not null references public.mentors(user_id) on delete cascade,
  student_id  uuid not null,
  status      text not null default 'active',       -- active | removed
  joined_at   timestamptz not null default now(),
  primary key (mentor_id, student_id)
);
create index if not exists academy_enroll_student on public.academy_enrollments(student_id);

create table if not exists public.lesson_progress (
  student_id   uuid not null,
  lesson_id    uuid not null references public.academy_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

-- Comunidad (feed estilo Skool): posts del mentor y alumnos + comentarios.
create table if not exists public.academy_posts (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.mentors(user_id) on delete cascade,
  author_id  uuid not null,
  body       text not null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists academy_posts_mentor on public.academy_posts(mentor_id, created_at desc);

create table if not exists public.academy_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.academy_posts(id) on delete cascade,
  author_id  uuid not null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists academy_comments_post on public.academy_comments(post_id, created_at);

-- Capacidad de plan: quien pueda SER mentor lleva capabilities.academy = true
-- (plan "Mentor" o add-on). Los alumnos no necesitan capacidad para inscribirse.


-- ===== academy_gamify.sql =====

-- Onyx Academy · gamificación estilo Skool + portadas. Ejecutar tras academy.sql.

-- Portadas / imagen para el look de "classroom" y la cabecera de la comunidad.
alter table public.academy_modules add column if not exists cover_url text;
alter table public.mentors        add column if not exists cover_url text;

-- Likes de posts y comentarios (dan puntos al autor, como en Skool).
create table if not exists public.academy_likes (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null,               -- 'post' | 'comment'
  target_id   uuid not null,
  user_id     uuid not null,
  mentor_id   uuid not null,               -- comunidad a la que pertenece
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);
create index if not exists academy_likes_target on public.academy_likes(target_type, target_id);
create index if not exists academy_likes_mentor_at on public.academy_likes(mentor_id, created_at);

-- Puntos acumulados por miembro en cada comunidad (all-time). El nivel se calcula
-- a partir de los puntos con los umbrales de Skool (en lib/academy.ts).
create table if not exists public.academy_points (
  mentor_id  uuid not null,
  user_id    uuid not null,
  points     int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (mentor_id, user_id)
);
create index if not exists academy_points_board on public.academy_points(mentor_id, points desc);


-- ===== academy_pay.sql =====

-- Onyx Academy · pagos (Stripe Connect) + niveles + comisión. Ejecutar tras academy.sql.

-- Cuenta Stripe conectada del mentor (Express) para cobrar a sus alumnos.
alter table public.mentors add column if not exists stripe_account_id text;
alter table public.mentors add column if not exists charges_enabled boolean not null default false;
-- Comisión de Onyx para ESTE mentor (%). NULL = usa el % por defecto del panel.
-- Editable por el dueño en Admin → Onyx Academy.
alter table public.mentors add column if not exists fee_pct numeric;

-- Productos/niveles que vende el mentor (curso básico, VIP, bootcamp…).
create table if not exists public.academy_products (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references public.mentors(user_id) on delete cascade,
  name        text not null,
  description text,
  kind        text not null default 'subscription',  -- subscription | one_time
  interval    text not null default 'month',          -- month | year (para subscription)
  price_cents int not null default 0,                 -- precio en centavos
  currency    text not null default 'usd',
  grants      jsonb not null default '"all"'::jsonb,   -- "all" o [module_id, ...]
  active      boolean not null default true,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists academy_products_mentor on public.academy_products(mentor_id, position);

-- Compras/suscripciones del alumno (dan acceso a los módulos concedidos).
create table if not exists public.academy_purchases (
  id             uuid primary key default gen_random_uuid(),
  mentor_id      uuid not null,
  student_id     uuid not null,
  product_id     uuid not null,
  kind           text not null,                        -- subscription | one_time
  status         text not null default 'active',       -- active | canceled | past_due
  stripe_session_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at     timestamptz not null default now(),
  unique (student_id, product_id)
);
create index if not exists academy_purchases_student on public.academy_purchases(student_id);
create index if not exists academy_purchases_sub on public.academy_purchases(stripe_subscription_id);

-- Libro de comisiones de Onyx (nuestro 10% de cada venta del mentor).
create table if not exists public.onyx_commissions (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null,
  student_id   uuid,
  product_id   uuid,
  gross_cents  int not null default 0,      -- lo que pagó el alumno
  fee_cents    int not null default 0,      -- nuestra comisión
  currency     text not null default 'usd',
  kind         text,                        -- subscription | one_time
  created_at   timestamptz not null default now()
);
create index if not exists onyx_commissions_at on public.onyx_commissions(created_at);


-- ===== academy_v2.sql =====

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


-- ===== academy_v3.sql =====

-- Onyx Academy v3 · traders verificados + perks de nivel (Copy/Guardian).
-- Ejecutar tras academy_v2.sql.

-- Opt-in: el usuario decide mostrar su track record real en las academias.
alter table public.profiles add column if not exists academy_share_stats boolean not null default false;

-- Extras que incluye un nivel además de las aulas (ej. copy trading, Guardian).
-- Formato: {"copy": true, "guardian": true}. No ejecuta nada por sí solo:
-- solo se muestra al alumno y el mentor gestiona el acceso desde su lista.
alter table public.academy_products add column if not exists perks jsonb not null default '{}'::jsonb;


-- ===== academy_v4.sql =====

-- Onyx Academy v4 · concesión automática de Onyx Guardian por perk de nivel.
-- Ejecutar tras academy_v3.sql.

-- Marca por usuario: tiene Guardian concedido por una compra de academia activa.
-- Se recalcula al comprar/cancelar. La capacidad efectiva de Guardian pasa a ser
-- (plan.capabilities.manager) OR (profiles.academy_guardian).
alter table public.profiles add column if not exists academy_guardian boolean not null default false;
-- Onyx Guardian DE PAGO dentro de la academia: nivel comprado por el alumno.
alter table public.profiles add column if not exists academy_guardian_tier text not null default 'none';
alter table public.profiles add column if not exists academy_guardian_sub_id text;
create index if not exists idx_profiles_guardian_sub on public.profiles (academy_guardian_sub_id);


-- ===== academy_v5.sql =====

-- Onyx Academy v5 · membresía de pago (mensual) + landing de ventas.
-- Ejecutar tras academy_v4.sql.

-- Precio de membresía de la comunidad. 0 = academia gratis. >0 = de pago: hay que
-- suscribirse para entrar (los niveles/cursos internos siguen siendo upsells).
alter table public.mentors add column if not exists membership_price_cents int not null default 0;
alter table public.mentors add column if not exists membership_currency  text not null default 'usd';
alter table public.mentors add column if not exists membership_interval  text not null default 'month'; -- month | year
alter table public.mentors add column if not exists intro_video_url       text;   -- video de presentación (YouTube/Vimeo/.mp4)
alter table public.mentors add column if not exists pitch                 text;   -- descripción de ventas larga

-- Suscripciones de membresía de los alumnos a una comunidad de pago.
create table if not exists public.academy_memberships (
  id             uuid primary key default gen_random_uuid(),
  mentor_id      uuid not null,
  student_id     uuid not null,
  status         text not null default 'active',      -- active | canceled | past_due
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at     timestamptz not null default now(),
  unique (mentor_id, student_id)
);
create index if not exists academy_memberships_student on public.academy_memberships(student_id);
create index if not exists academy_memberships_sub on public.academy_memberships(stripe_subscription_id);


-- ===== academy_v6.sql =====

-- Onyx Academy v6 · imágenes en posts, comentarios y chat privado.
-- Ejecutar tras academy_v5.sql.
alter table public.academy_posts    add column if not exists image_url text;
alter table public.academy_comments add column if not exists image_url text;
alter table public.academy_messages add column if not exists image_url text;


-- ===== academy_v7.sql =====

-- Onyx Academy v7 · programar posts + campañas de email del mentor. Tras academy_v6.sql.

-- Programar publicaciones: si scheduled_at es futuro, el post no se muestra hasta su hora.
alter table public.academy_posts add column if not exists scheduled_at timestamptz;

-- Automatizaciones de email por academia (toggles).
alter table public.mentors add column if not exists email_auto jsonb not null
  default '{"welcome":true,"class_reminder":true,"expiring":true}'::jsonb;

-- Campañas de email (broadcast) del mentor a sus alumnos.
create table if not exists public.academy_emails (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references public.mentors(user_id) on delete cascade,
  subject      text not null,
  body         text not null,
  audience     text not null default 'all',        -- all | active | inactive | expiring
  scheduled_at timestamptz,                          -- null = enviar ya
  status       text not null default 'draft',        -- draft | scheduled | sending | sent
  sent_count   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists academy_emails_mentor on public.academy_emails(mentor_id, created_at desc);
create index if not exists academy_emails_due on public.academy_emails(status, scheduled_at);

-- Registro para no repetir envíos automáticos (bienvenida, recordatorio, expiración).
create table if not exists public.academy_email_log (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null,
  student_id uuid not null,
  kind       text not null,          -- welcome | class_reminder | expiring | campaign
  ref        text not null default '',
  created_at timestamptz not null default now(),
  unique (mentor_id, student_id, kind, ref)
);


-- ===== academy_v8.sql =====

-- Onyx Academy v8 · certificados + afiliados del mentor + auditoría AI. Tras academy_v7.sql.

-- Certificados al completar un curso (o toda la academia).
create table if not exists public.academy_certificates (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null,
  student_id uuid not null,
  kind       text not null default 'course',   -- course | academy
  module_id  uuid,
  title      text not null,
  code       text not null unique,             -- para verificar/compartir
  issued_at  timestamptz not null default now(),
  unique (mentor_id, student_id, kind, module_id)
);
create index if not exists academy_cert_student on public.academy_certificates(student_id);

-- Afiliados: cada miembro invita; si trae miembros que PAGAN, se registra el referido.
-- No mueve dinero automáticamente (seguridad): es un libro para que el mentor premie.
alter table public.mentors add column if not exists affiliate_reward_cents int not null default 0;
alter table public.mentors add column if not exists affiliate_currency text not null default 'usd';

create table if not exists public.academy_referrals (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null,
  referrer_id  uuid not null,                  -- quién invitó
  referred_id  uuid not null,                  -- quién se unió
  paid         boolean not null default false, -- ¿el referido ya pagó algo?
  reward_cents int not null default 0,         -- recompensa acreditada al referidor
  created_at   timestamptz not null default now(),
  unique (mentor_id, referred_id)
);
create index if not exists academy_ref_mentor on public.academy_referrals(mentor_id);
create index if not exists academy_ref_referrer on public.academy_referrals(referrer_id);

-- Auditoría AI del alumno (boletín del mentor sobre el trading real del alumno).
create table if not exists public.academy_audits (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null,
  student_id uuid not null,
  period     text not null default '30d',
  metrics    jsonb,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists academy_audit_student on public.academy_audits(student_id, created_at desc);


-- ===== academy_v9.sql =====

-- ============================================================
-- Onyx Academy · v9 — Auditoría de alumnos como add-on de pago del mentor.
-- Add-on 'audit' (nivel de pago) + consentimiento POR-MENTOR (revocable) +
-- notas privadas del mentor + "plan verificado por su mentor".
-- Idempotente: se puede correr varias veces sin romper nada.
-- Correr DESPUÉS de academy_v8.sql.
-- ============================================================

-- 1) Consentimiento del alumno para que UN mentor concreto vea su track record.
--    Granular (por mentor, no global) y revocable en cualquier momento.
create table if not exists academy_audit_consent (
  mentor_id   uuid not null,
  student_id  uuid not null,
  granted     boolean not null default true,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  primary key (mentor_id, student_id)
);
create index if not exists idx_audit_consent_mentor on academy_audit_consent (mentor_id) where granted;

-- 2) Notas privadas del mentor sobre un alumno (solo las ve el mentor).
create table if not exists academy_student_notes (
  mentor_id   uuid not null,
  student_id  uuid not null,
  notes       text,
  updated_at  timestamptz not null default now(),
  primary key (mentor_id, student_id)
);

-- 3) "Plan verificado por su mentor" — sello opcional que otorga el mentor.
create table if not exists academy_plan_verified (
  mentor_id    uuid not null,
  student_id   uuid not null,
  verified     boolean not null default false,
  verified_at  timestamptz,
  primary key (mentor_id, student_id)
);

-- 4) El add-on 'audit' es un nivel más (academy_products) con kind='audit'.
--    No hace falta columna nueva; kind ya es texto libre. Documentado aquí:
--    kind ∈ ('subscription','one_time','audit'). Un producto 'audit' concede el
--    acceso del mentor a auditar (KPIs + trades + reporte AI) mientras esté activo.

-- 5) Guardar el semáforo/score de disciplina de la última auditoría (para el panel).
alter table academy_audits add column if not exists discipline int;
alter table academy_audits add column if not exists light text;


-- ===== academy_v10.sql =====

-- ============================================================
-- Onyx Academy · v10 — Branding del mentor, logo/foto, redes sociales,
-- toggle de emojis del AI y plantillas de correos automáticos editables.
-- Idempotente. Correr DESPUÉS de academy_v9.sql.
-- ============================================================

-- Logo/foto del mentor (reemplaza el ícono del hero).
alter table mentors add column if not exists logo_url text;

-- Info de marca que el AI usa como contexto (historia, tono de voz, propuesta).
alter table mentors add column if not exists brand_info text;

-- ¿El AI usa emojis? (el mentor decide).
alter table mentors add column if not exists ai_emojis boolean not null default true;

-- Redes sociales del mentor (whatsapp, instagram, facebook, tiktok, youtube,
-- telegram, x). Guardamos usuario o URL; el front arma el enlace.
alter table mentors add column if not exists socials jsonb not null default '{}'::jsonb;

-- Plantillas editables de correos automáticos por-tipo:
-- { welcome:{enabled,subject,body}, class_reminder:{enabled,subject,body,lead_min},
--   expiring:{enabled,subject,body,days_before} }
alter table mentors add column if not exists email_templates jsonb not null default '{}'::jsonb;


-- ===== academy_v11.sql =====

-- ============================================================
-- Onyx Academy · v11 — Muro de Logros + "en línea" de miembros.
-- Idempotente. Correr DESPUÉS de academy_v10.sql.
-- ============================================================

-- Muro de Logros: el alumno sube su prueba (retiro, reto superado, certificado…),
-- entra a la cola del mentor y este la aprueba antes de publicarla.
create table if not exists academy_wins (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null,
  student_id   uuid not null,
  kind         text not null default 'payout',   -- payout | challenge | certificate | goal
  title        text,
  amount_cents bigint,                            -- opcional (monto del retiro/reto)
  currency     text default 'usd',
  prop_firm    text,                              -- opcional
  image_url    text,                              -- prueba (captura/certificado)
  status       text not null default 'pending',   -- pending | approved | rejected
  verified     boolean not null default false,    -- sello del mentor
  likes        int not null default 0,
  created_at   timestamptz not null default now(),
  approved_at  timestamptz
);
create index if not exists idx_wins_mentor on academy_wins (mentor_id, status, created_at desc);
create index if not exists idx_wins_student on academy_wins (student_id);

-- Likes/felicitaciones a un logro (un like por usuario).
create table if not exists academy_win_likes (
  win_id   uuid not null,
  user_id  uuid not null,
  primary key (win_id, user_id)
);

-- "En línea": última actividad del usuario (para el puntito verde).
alter table profiles add column if not exists last_seen_at timestamptz;


-- ===== academy_v12.sql =====

-- ============================================================
-- Onyx Academy · v12 — Colaboradores con roles/permisos + etiqueta.
-- Idempotente. Correr DESPUÉS de academy_v11.sql.
-- ============================================================

-- Colaboradores de la academia: el mentor invita a un miembro, le pone un rol
-- (etiqueta visible) y permisos. perms: { moderate, post, message, events }.
create table if not exists academy_collaborators (
  mentor_id   uuid not null,
  user_id     uuid not null,
  role        text not null default 'Colaborador',   -- etiqueta que se muestra
  perms       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  primary key (mentor_id, user_id)
);
create index if not exists idx_collab_mentor on academy_collaborators (mentor_id);


-- ===== academy_v13.sql =====

-- ============================================================
-- Onyx Academy · v13 — Asistente AI del alumno (base de conocimiento del mentor)
-- + resumen semanal AI (no requiere columnas, se calcula al vuelo).
-- Idempotente. Correr DESPUÉS de academy_v12.sql.
-- ============================================================

-- El mentor pega su guía / preguntas frecuentes. El asistente AI responde a los
-- alumnos USANDO SOLO este texto (no inventa). Vacío = asistente desactivado.
alter table mentors add column if not exists assistant_kb text;
-- Interruptor para mostrar el asistente a los alumnos.
alter table mentors add column if not exists assistant_on boolean not null default false;


-- ===== academy_v14.sql =====

-- ============================================================
-- Onyx Academy · v14 — Onboarding del mentor + retención (analíticas al vuelo).
-- Idempotente. Correr DESPUÉS de academy_v13.sql.
-- ============================================================

-- El mentor puede ocultar la lista de configuración una vez la completa.
alter table mentors add column if not exists onboarding_dismissed boolean not null default false;

-- (La retención usa profiles.last_seen_at, academy_enrollments.joined_at,
--  academy_memberships/purchases.status y posts/comments — ya existen.)


-- ===== academy_v15.sql =====

-- ============================================================
-- Onyx Academy · v15 — Preferencias de notificaciones push del alumno.
-- Idempotente. Correr DESPUÉS de academy_v14.sql.
-- ============================================================

-- Qué push quiere recibir cada usuario en la academia. Clave ausente = activa.
-- { announcements:bool, messages:bool, classes:bool, wins:bool }
alter table profiles add column if not exists academy_push_prefs jsonb not null default '{}'::jsonb;


-- ===== academy_v16.sql =====

-- ============================================================
-- Onyx Academy · v16 — Grabaciones de clases, plan anual, reseñas verificadas.
-- (Los cupones se hacen con los Promotion Codes de Stripe: sin SQL.)
-- Idempotente. Correr DESPUÉS de academy_v15.sql.
-- ============================================================

-- Grabación de la clase en vivo (link de YouTube/Vimeo/.mp4).
alter table academy_events add column if not exists recording_url text;

-- PDF de la lección (se muestra página por página dentro del aula).
alter table academy_lessons add column if not exists pdf_url text;

-- Precio anual de la membresía (opcional). 0 = sin opción anual.
alter table mentors add column if not exists membership_year_cents bigint not null default 0;

-- Reseñas verificadas de alumnos (solo miembros; el mentor aprueba antes de publicar).
create table if not exists academy_reviews (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null,
  student_id  uuid not null,
  rating      int  not null default 5,   -- 1..5
  body        text,
  status      text not null default 'pending',  -- pending | approved | rejected
  created_at  timestamptz not null default now(),
  unique (mentor_id, student_id)
);
create index if not exists idx_reviews_mentor on academy_reviews (mentor_id, status);


-- ===== academy_v17.sql =====

-- ============================================================
-- Onyx Academy · v17 — Comisión por plan del mentor + historial de cambios.
-- Idempotente. Correr DESPUÉS de academy_v16.sql.
-- ============================================================

-- 1) Comisión de academia por plan, dentro del JSON capabilities de cada plan.
--    Es solo la SEMILLA por defecto; luego se edita desde el panel del dueño.
--    Entre más alto el plan, menor la comisión. (El operador `||` fusiona el JSON.)
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy_fee_pct":15}'::jsonb where id = 'free';
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy_fee_pct":10}'::jsonb where id = 'pro';
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy_fee_pct":6}'::jsonb  where id = 'elite';
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy_fee_pct":3}'::jsonb  where id in ('black_onyx', 'black');

-- 2) Historial de cambios de comisión (quién / cuándo / ámbito / valor).
create table if not exists academy_fee_log (
  id          uuid primary key default gen_random_uuid(),
  actor_email text,
  scope       text not null,          -- default | plan | mentor
  target      text,                   -- id del plan o del mentor (null para 'default')
  pct         numeric,                -- % nuevo; null = vuelve al valor heredado
  created_at  timestamptz not null default now()
);
create index if not exists idx_fee_log_created on academy_fee_log (created_at desc);

notify pgrst, 'reload schema';


-- ===== academy_v18.sql =====

-- ============================================================
-- Onyx Academy · v18 — Control del mentor sobre alumnos + descarga de PDF.
-- Idempotente. Correr DESPUÉS de academy_v17.sql.
-- ============================================================

-- Nombre visible del alumno DENTRO de la academia (alias que el mentor puede
-- corregir; NO toca el perfil global del usuario). Null = usa su nombre real.
alter table academy_enrollments add column if not exists display_name text;

-- El estado de la inscripción ya admite 'banned' (además de 'active').
-- No requiere columna nueva; el mentor lo cambia desde su panel.

-- ¿El alumno puede descargar el PDF de la lección? true por defecto.
alter table academy_lessons add column if not exists pdf_download boolean not null default true;

notify pgrst, 'reload schema';


-- ===== academy_v19.sql =====

-- ============================================================
-- Onyx Academy · v19 — Suscripciones abrir/cerrar + lista de espera,
-- tipos de publicación, y anuncios. Idempotente. Correr tras academy_v18.sql.
-- ============================================================

-- ¿Acepta nuevas suscripciones? Cierre con o sin fecha de reapertura.
alter table mentors add column if not exists subs_open boolean not null default true;
alter table mentors add column if not exists subs_reopen_at timestamptz;      -- null = sin fecha
alter table mentors add column if not exists subs_closed_note text;           -- mensaje opcional

-- Tipo de publicación de la comunidad + subtipo de logro.
-- kind: community | analysis | habits | question | win   (default community)
-- win_kind: payout | challenge | goal  (solo cuando kind = win)
alter table academy_posts add column if not exists kind text not null default 'community';
alter table academy_posts add column if not exists win_kind text;
-- Marca de "anuncio destacado" (además de pinned).
alter table academy_posts add column if not exists announcement boolean not null default false;

-- Lista de espera: visitantes que quieren aviso cuando reabran las inscripciones.
create table if not exists academy_waitlist (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null,
  email       text not null,
  created_at  timestamptz not null default now(),
  unique (mentor_id, email)
);
create index if not exists idx_waitlist_mentor on academy_waitlist (mentor_id);

notify pgrst, 'reload schema';


-- ===== academy_v20.sql =====

-- ============================================================
-- Onyx Academy · v20 · Moderación de la comunidad
-- Filtro de contenido (palabras + spam + IA), cola de revisión, reportes de la
-- comunidad y sanciones progresivas (aviso / silencio / ban). El mentor decide
-- cuán estricto quiere ser; por defecto se crea en nivel "normal".
-- Idempotente: se puede correr varias veces sin romper nada.
-- ============================================================

-- Ajustes de moderación del mentor (JSON). Vacío = usa el default "normal" del código.
alter table public.mentors add column if not exists moderation jsonb not null default '{}'::jsonb;

-- Estado de moderación de posts y comentarios.
--   visible  → publicado y a la vista de todos
--   pending  → esperando aprobación (lo marcó el filtro o es un nuevo miembro)
--   hidden   → ocultado por el equipo (o auto-ocultado por reportes)
alter table public.academy_posts    add column if not exists status      text not null default 'visible';
alter table public.academy_posts    add column if not exists flag_reason text;
alter table public.academy_comments  add column if not exists status      text not null default 'visible';
alter table public.academy_comments  add column if not exists flag_reason text;
create index if not exists academy_posts_status    on public.academy_posts(mentor_id, status, created_at desc);

-- Silencio temporal + conteo de publicaciones (para el modo "nuevo miembro a revisión").
alter table public.academy_enrollments add column if not exists muted_until timestamptz;
alter table public.academy_enrollments add column if not exists posts_count integer not null default 0;

-- Reportes de la comunidad (cualquier miembro puede denunciar un contenido).
create table if not exists public.academy_reports (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null references public.mentors(user_id) on delete cascade,
  reporter_id  uuid not null,
  target_type  text not null,                       -- post | comment | dm | profile | win
  target_id    text not null,
  reason       text,
  status       text not null default 'open',         -- open | resolved | dismissed
  created_at   timestamptz not null default now()
);
create index if not exists academy_reports_open on public.academy_reports(mentor_id, status, created_at desc);
create unique index if not exists academy_reports_uniq on public.academy_reports(mentor_id, reporter_id, target_type, target_id);

-- Historial de sanciones por alumno (aviso / silencio / ban / readmisión).
create table if not exists public.academy_infractions (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null references public.mentors(user_id) on delete cascade,
  student_id  uuid not null,
  actor_id    uuid,                                  -- quién aplicó la acción (mentor/colaborador/sistema)
  kind        text not null,                         -- warn | mute | unmute | ban | unban | block
  reason      text,
  until       timestamptz,                           -- para silencios temporales
  created_at  timestamptz not null default now()
);
create index if not exists academy_infractions_student on public.academy_infractions(mentor_id, student_id, created_at desc);

-- Nota: la moderación de IMÁGENES por contenido ya existe en la ruta de subida
-- (lib/academyAI.moderateImage). Esta migración añade la capa de TEXTO y la gestión.


-- ===== academy_v21.sql =====

-- ============================================================
-- Onyx Academy · v21 · Foto de perfil (avatar) del alumno
-- El alumno puede subir su propia foto de perfil para la comunidad.
-- El nombre visible en la academia sigue guardándose en academy_enrollments.display_name
-- (el alumno lo edita para su propia inscripción; el mentor puede sobrescribirlo).
-- Idempotente.
-- ============================================================
alter table public.profiles add column if not exists avatar_url text;

-- Marca de "editado" para posts y comentarios (el alumno puede editar lo suyo).
alter table public.academy_posts    add column if not exists edited_at timestamptz;
alter table public.academy_comments add column if not exists edited_at timestamptz;


-- ===== academy_v22.sql =====

-- ============================================================
-- Onyx Academy · v22 · Crear academia = función de pago
-- Un usuario en plan GRATIS puede ser ALUMNO de una o varias academias, pero NO
-- puede TENER (crear) su propia academia sin pagar. La capacidad "academy" queda
-- solo en los planes de pago (Pro/Elite/Black). Onyx gana por dos vías con cada
-- mentor: (1) su suscripción de plan y (2) la comisión por venta a sus alumnos.
-- Idempotente.
-- ============================================================

-- Quitar la capacidad de crear academia al plan Gratis.
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy": false}'::jsonb where id = 'free';

-- Asegurar que los planes de pago SÍ pueden crear academia.
update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"academy": true}'::jsonb where id in ('pro', 'elite', 'black');


-- ===== academy_v23.sql =====

-- ============================================================
-- Onyx Academy · v23 · Facturación robusta de comisiones
-- Arregla tres cosas del libro de comisiones (onyx_commissions):
--  1) Idempotencia: cada comisión se ata a una referencia única de Stripe
--     (factura o payment_intent), así un reintento de webhook NO duplica.
--  2) Renovaciones: al registrar por factura, las comisiones mensuales se anotan.
--  3) Reembolsos: una comisión se puede marcar 'reversed' sin borrarla.
-- Idempotente.
-- ============================================================
alter table public.onyx_commissions add column if not exists status      text not null default 'earned'; -- earned | reversed
alter table public.onyx_commissions add column if not exists stripe_ref  text;   -- invoice id o payment_intent
alter table public.onyx_commissions add column if not exists reversed_at timestamptz;

-- Backfill: las filas existentes cuentan como ganadas.
update public.onyx_commissions set status = 'earned' where status is null;

-- Una comisión por referencia de Stripe y mentor (evita doble conteo en reintentos).
create unique index if not exists onyx_commissions_ref on public.onyx_commissions(mentor_id, stripe_ref) where stripe_ref is not null;


-- ===== academy_v24.sql =====

-- ============================================================
-- Onyx Academy v24 · Pagos a los referidos del mentor (rieles A + B).
--  Riel A = crédito en la academia (Stripe customer balance, automático).
--  Riel B = pago manual fuera de plataforma (efectivo/PayPal/Zelle/banco).
-- Cada recompensa tiene ciclo de vida: pending → available → paid | reversed.
-- academy_referrals se conserva SOLO para la atribución (quién trajo a quién).
-- ============================================================

-- ---- Ajustes de afiliado por mentor ----
alter table public.mentors add column if not exists affiliate_type      text    not null default 'flat';   -- 'flat' | 'pct'
alter table public.mentors add column if not exists affiliate_pct       numeric not null default 0;        -- % de la venta cuando type='pct'
alter table public.mentors add column if not exists affiliate_recurring boolean not null default false;    -- pagar también en cada renovación
alter table public.mentors add column if not exists affiliate_hold_days int     not null default 14;       -- ventana anti-reembolso
alter table public.mentors add column if not exists affiliate_min_cents int     not null default 0;        -- mínimo para pagar
alter table public.mentors add column if not exists affiliate_rail      text    not null default 'manual'; -- 'credit' | 'manual'
-- Métodos de cobro que el mentor ofrece a sus referidos (el referido solo ve estos).
alter table public.mentors add column if not exists affiliate_payout_methods jsonb not null default '["paypal","zelle","crypto"]'::jsonb;
-- (ya existían: affiliate_reward_cents, affiliate_currency)

-- ---- Libro de recompensas por evento (una por factura/pago) ----
create table if not exists public.academy_reward_events (
  id           uuid primary key default gen_random_uuid(),
  mentor_id    uuid not null,
  referrer_id  uuid not null,                    -- quién cobra
  referred_id  uuid not null,                    -- quién pagó su membresía/nivel
  amount_cents int  not null default 0,
  currency     text not null default 'usd',
  status       text not null default 'pending',  -- pending | available | paid | reversed
  rail         text not null default 'manual',   -- credit | manual (cómo se paga)
  stripe_ref   text,                             -- invoice.id o payment_intent (idempotencia + reversión)
  kind         text not null default 'first',    -- first | renewal | one_time
  available_at timestamptz,                      -- cuándo pasa de en-espera a disponible
  paid_at      timestamptz,
  paid_method  text,                             -- credit | paypal | zelle | bank | cash | other
  paid_note    text,
  payout_id    uuid,                             -- lote de pago (academy_referral_payouts)
  reversed_at  timestamptz,
  created_at   timestamptz not null default now()
);
-- Idempotencia: un reintento del webhook no duplica la recompensa de la misma factura.
create unique index if not exists academy_reward_ref  on public.academy_reward_events(mentor_id, stripe_ref) where stripe_ref is not null;
create index if not exists academy_reward_mentor       on public.academy_reward_events(mentor_id);
create index if not exists academy_reward_referrer     on public.academy_reward_events(referrer_id);
create index if not exists academy_reward_status       on public.academy_reward_events(mentor_id, status);

-- ---- Lotes de pago manual (para el historial y el recibo del referido) ----
create table if not exists public.academy_referral_payouts (
  id          uuid primary key default gen_random_uuid(),
  mentor_id   uuid not null,
  referrer_id uuid not null,
  total_cents int  not null default 0,
  currency    text not null default 'usd',
  method      text,                              -- paypal | zelle | bank | cash | other
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists academy_payout_mentor   on public.academy_referral_payouts(mentor_id);
create index if not exists academy_payout_referrer on public.academy_referral_payouts(referrer_id);

-- ---- Método de cobro del referido (por academia) ----
create table if not exists public.academy_payout_methods (
  mentor_id   uuid not null,
  referrer_id uuid not null,
  method      text,                              -- paypal | zelle | bank | cash | crypto | other
  handle      text,                              -- correo / número / cuenta / billetera
  network     text,                              -- red de la billetera si method = crypto
  updated_at  timestamptz not null default now(),
  primary key (mentor_id, referrer_id)
);


-- ===== ambassadors_fix.sql =====

-- ============================================
-- Onyx · Arreglo: la tabla de pagos de embajadores
-- ============================================
-- Problema: 'payouts' ya existia para los retiros de cuentas fondeadas,
-- asi que la tabla de pagos de embajadores nunca llego a crearse.
-- Solucion: usarla con su propio nombre.
--
-- Ejecuta este archivo en Supabase → SQL Editor.

create table if not exists ambassador_payouts (
  id uuid primary key default uuid_generate_v4(),
  ambassador_id uuid not null references ambassadors(id) on delete cascade,
  amount numeric not null,
  method text,
  details text,
  status text not null default 'requested',     -- requested | paid | rejected
  note text,
  requested_at timestamptz default now(),
  paid_at timestamptz
);

create index if not exists ambassador_payouts_amb_idx on ambassador_payouts (ambassador_id, status);

notify pgrst, 'reload schema';


-- ===== ambassadors_v1.sql =====

-- ============================================
-- Onyx Trading Live · Programa de embajadores
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Ajustes globales del programa (editables desde el panel admin)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

insert into app_settings (key, value) values ('ambassadors', '{
  "enabled": true,
  "base_rate": 20,
  "tier_rate": 30,
  "tier_threshold": 10,
  "hold_days": 30,
  "min_payout": 50,
  "coupon_percent": 20,
  "coupon_months": 1
}'::jsonb) on conflict (key) do nothing;

-- Embajadores
create table if not exists ambassadors (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,                    -- lo que va en ?ref=
  status text not null default 'pending',       -- pending | approved | rejected | paused
  rate numeric,                                 -- si se rellena, manda sobre los niveles
  audience text,                                -- dónde tiene comunidad
  followers int,
  payout_method text,                           -- paypal | usdt | credit
  payout_details text,                          -- correo de PayPal o billetera
  promo_code_id text,                           -- id del código promocional en Stripe
  note text,                                    -- notas internas del admin
  created_at timestamptz default now(),
  approved_at timestamptz,
  unique (user_id)
);

-- Usuarios traídos por un embajador (atribución de por vida)
create table if not exists referrals (
  id uuid primary key default uuid_generate_v4(),
  ambassador_id uuid not null references ambassadors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text default 'link',                   -- link | coupon
  created_at timestamptz default now(),
  first_paid_at timestamptz,
  unique (user_id)                              -- un usuario pertenece a un solo embajador
);

-- Comisiones generadas en cada cobro
create table if not exists commissions (
  id uuid primary key default uuid_generate_v4(),
  ambassador_id uuid not null references ambassadors(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  invoice_id text unique,                       -- evita duplicados si Stripe reintenta
  base_amount numeric not null default 0,       -- lo que pagó el cliente
  rate numeric not null default 0,
  amount numeric not null default 0,            -- comisión
  currency text default 'USD',
  status text not null default 'pending',       -- pending | available | paid | reversed
  available_at timestamptz,                     -- cuándo deja de estar retenida
  payout_id uuid,
  created_at timestamptz default now()
);

-- Solicitudes de pago de embajadores (ojo: 'payouts' ya existe para retiros de fondeo)
create table if not exists ambassador_payouts (
  id uuid primary key default uuid_generate_v4(),
  ambassador_id uuid not null references ambassadors(id) on delete cascade,
  amount numeric not null,
  method text,
  details text,
  status text not null default 'requested',     -- requested | paid | rejected
  note text,
  requested_at timestamptz default now(),
  paid_at timestamptz
);

-- Clics en el enlace (para medir conversión)
create table if not exists ref_clicks (
  id bigserial primary key,
  code text not null,
  created_at timestamptz default now()
);

-- A qué embajador pertenece cada usuario
alter table profiles add column if not exists referred_by uuid references ambassadors(id) on delete set null;

create index if not exists commissions_amb_idx on commissions (ambassador_id, status);
create index if not exists referrals_amb_idx on referrals (ambassador_id);
create index if not exists ref_clicks_code_idx on ref_clicks (code, created_at);

notify pgrst, 'reload schema';


-- ===== ambassador_kit.sql =====

-- ============================================================
-- Kit de reclutamiento de embajadores: prospectos (mini-CRM).
-- Correr una vez en Supabase. Idempotente.
-- ============================================================
create table if not exists public.ambassador_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- nombre o @handle del creador
  platform text default 'youtube',    -- youtube | instagram | tiktok | telegram | x | other
  niche text default 'prop',          -- prop | beginners | signals | forex | crypto | other
  handle text,                        -- @usuario o URL del canal
  email text,                         -- para enviar la invitación
  status text not null default 'new', -- new | contacted | replied | joined | passed
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists amb_prospects_status on public.ambassador_prospects (status, created_at desc);
alter table public.ambassador_prospects enable row level security;


-- ===== audit_history.sql =====

-- Historial de auditorías (para el calendario, el gráfico y los promedios).
-- Cada corrida de la auditoría (CI de GitHub) guarda una fila con sus notas.
-- Correr una vez en Supabase. Idempotente.
create table if not exists public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  url text,
  performance int, accessibility int, seo int, best_practices int,
  lcp numeric, inp numeric, cls numeric,
  ts_errors int default 0, vulnerabilities int default 0,
  sec_overall text, sec_fails int default 0, sec_warns int default 0
);
create index if not exists audit_runs_at on public.audit_runs (at desc);

-- RLS: el panel lee con rol de servicio; nadie con la clave pública.
alter table public.audit_runs enable row level security;


-- ===== blog.sql =====

-- ============================================================
-- Blog público (SEO). Artículos bilingües (ES/EN) que Google puede indexar,
-- con programación de publicación (draft | scheduled | published).
-- Correr una sola vez en el SQL Editor de Supabase. Idempotente.
-- ============================================================
create table if not exists blog_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title_es     text not null default '',
  title_en     text not null default '',
  excerpt_es   text default '',
  excerpt_en   text default '',
  body_es      text default '',            -- markdown
  body_en      text default '',            -- markdown
  cover_url    text,
  tags         text default '',
  status       text not null default 'draft',   -- draft | scheduled | published
  publish_at   timestamptz,                     -- cuándo se debe publicar (si scheduled)
  published_at timestamptz,                      -- cuándo se publicó de verdad
  author       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists blog_posts_status_idx on blog_posts (status, publish_at);
create index if not exists blog_posts_pub_idx    on blog_posts (published_at desc);

-- Solo el backend (service role) escribe/lee; las páginas públicas leen vía service role.
alter table blog_posts enable row level security;

notify pgrst, 'reload schema';


-- ===== bots.sql =====

-- ============================================================
-- Módulo de bots (traders algorítmicos): rendimiento por estrategia,
-- separado en "En pruebas" (demo/forward) y "En vivo" (real/fondeo).
-- Cada operación queda etiquetada con el magic number del EA que la abrió.
-- Correr una sola vez en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- 1) Etiquetar cada operación con el bot que la generó
alter table trades         add column if not exists magic      bigint;
alter table trades         add column if not exists ea_comment text;
alter table open_positions add column if not exists magic      bigint;
alter table open_positions add column if not exists ea_comment text;

create index if not exists trades_magic_idx on trades (account_id, magic);

-- 2) Configuración por bot (nombre, modo y criterios de graduación)
create table if not exists bots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  magic      bigint not null,
  name       text,
  mode       text not null default 'auto',          -- auto | testing | live (override manual)
  criteria   jsonb not null default '{}'::jsonb,     -- {minDays, minTrades, pf, maxDD}
  notes      text,
  created_at timestamptz not null default now(),
  unique (user_id, magic)
);

-- Perfil esperado del backtest, para comparar el vivo vs el backtest (Fase 3).
alter table bots add column if not exists backtest jsonb not null default '{}'::jsonb;

-- Add-on: el módulo de bots también se puede comprar suelto (no solo por plan).
alter table profiles add column if not exists addon_algo boolean not null default false;

-- Solo el backend (service role) accede; bloqueamos el acceso público.
alter table bots enable row level security;


-- ===== bots2_account.sql =====

-- ============================================================
-- Robots v2: un bot se identifica por CUENTA + magic number (antes solo por magic,
-- lo que mezclaba cuentas). Así una misma cuenta puede tener todos los bots que
-- quiera, cada uno por su magic, y dos cuentas no se pisan aunque compartan magic.
-- Correr una sola vez en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- 1) Atar cada configuración de bot a una cuenta concreta.
alter table bots add column if not exists account_id uuid references trading_accounts(id) on delete cascade;

-- 2) Backfill: si una config (magic) tiene operaciones en una sola cuenta del dueño,
--    la atamos a esa cuenta. Si opera en varias, se deja como estaba (global/legacy).
update bots b
set account_id = sub.account_id
from (
  select t.magic, (array_agg(distinct t.account_id))[1] as account_id, count(distinct t.account_id) as n
  from trades t
  where t.magic is not null and t.magic <> 0
  group by t.magic
) sub
where b.account_id is null
  and b.magic = sub.magic
  and sub.n = 1
  and sub.account_id in (select id from trading_accounts where user_id = b.user_id);

-- 3) Quitar la unicidad vieja (user_id, magic) que impedía el mismo magic en dos cuentas.
alter table bots drop constraint if exists bots_user_id_magic_key;

-- 4) Nueva unicidad por (usuario, cuenta, magic). Filas legacy con account_id NULL
--    conviven sin chocar (NULL se trata como distinto en índices únicos).
create unique index if not exists bots_user_acc_magic_uidx on bots (user_id, account_id, magic);
create index if not exists bots_account_idx on bots (account_id);


-- ===== campaigns.sql =====

-- ============================================================
-- Campañas de correo (seguimiento automático + envíos manuales).
-- Correr una vez en Supabase. Idempotente.
-- ============================================================

-- Plantillas/campañas. Una fila por campaña. El "cuerpo" y "asunto" son
-- editables desde Admin → Campañas, bilingües (es/en).
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  key text unique,                         -- clave estable para campañas automáticas (ej. 'no_connect'); null para manuales
  name text not null,                      -- nombre visible en el panel
  kind text not null default 'trigger',    -- trigger | scheduled | manual
  segment text not null default 'all',     -- id de segmento (ver lib/segments.ts)
  subject_es text default '',
  body_es text default '',
  subject_en text default '',
  body_en text default '',
  enabled boolean not null default false,   -- las automáticas empiezan apagadas
  trigger jsonb default '{}'::jsonb,        -- { days: 3 } etc. para las 'trigger'
  schedule text default '',                 -- cron para las 'scheduled' (informativo)
  scheduled_at timestamptz,                 -- promo programada: sale a esta fecha/hora y se limpia
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_kind on public.campaigns (kind);

-- Registro de a quién se le envió qué (dedupe: nunca el mismo correo dos veces).
create table if not exists public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  campaign_key text,                        -- copia estable por si se borra la campaña
  user_id uuid,
  email text not null,
  status text default 'sent',               -- sent | failed | bounced | complained
  resend_id text,                           -- id del mensaje en Resend (para correlacionar el webhook)
  delivered_at timestamptz,
  opened_at timestamptz,                     -- primera apertura
  clicked_at timestamptz,                    -- primer clic
  created_at timestamptz not null default now()
);

-- Por si las tablas YA existían de una corrida anterior: añade las columnas
-- nuevas (create table if not exists no las agrega a una tabla existente).
alter table public.campaigns      add column if not exists scheduled_at timestamptz;
alter table public.campaign_sends add column if not exists resend_id    text;
alter table public.campaign_sends add column if not exists delivered_at timestamptz;
alter table public.campaign_sends add column if not exists opened_at    timestamptz;
alter table public.campaign_sends add column if not exists clicked_at   timestamptz;

create index if not exists campaign_sends_rid on public.campaign_sends (resend_id);
create index if not exists campaign_sends_cam on public.campaign_sends (campaign_id, created_at desc);
create index if not exists campaign_sends_user on public.campaign_sends (user_id, campaign_key);
create index if not exists campaign_sends_at on public.campaign_sends (created_at desc);

alter table public.campaigns enable row level security;
alter table public.campaign_sends enable row level security;

-- Opt-out de marketing (separado de notify_email, que es transaccional) y token
-- para el enlace de baja de un solo clic.
alter table public.profiles add column if not exists marketing_emails boolean default true;
alter table public.profiles add column if not exists unsub_token text;


-- ===== chat.sql =====

-- ============================================================
-- Chat estilo WhatsApp: palomitas de leído + adjuntos en soporte,
-- y chat en vivo para empleados (canales, menciones, @Onyx AI).
-- Idempotente: se puede correr varias veces sin romper nada.
-- ============================================================

-- 1) Soporte: leído + adjuntos + quién del equipo escribió ----------
alter table if exists support_messages add column if not exists read_at    timestamptz;
alter table if exists support_messages add column if not exists attachments jsonb default '[]'::jsonb;
alter table if exists support_messages add column if not exists sender_id  uuid;   -- admin que respondió (para avatar/nombre)

-- 2) Chat de equipo: canales -----------------------------------------
create table if not exists chat_channels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null default 'channel',   -- 'channel' (abierto a todo el equipo) | 'dm'
  topic       text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

-- Miembros (solo para DMs; los canales abiertos los ven todos los admin)
create table if not exists chat_members (
  channel_id uuid not null references chat_channels(id) on delete cascade,
  user_id    uuid not null,
  primary key (channel_id, user_id)
);

-- Mensajes del equipo
create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references chat_channels(id) on delete cascade,
  sender_id   uuid,                         -- null = Onyx AI (bot)
  sender_name text,                         -- copia del nombre/email para no volver a buscarlo
  body        text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  mentions    jsonb not null default '[]'::jsonb,  -- [{type:'user'|'client'|'ticket', id, label}]
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_channel_idx on chat_messages (channel_id, created_at);

-- Marca de lectura por canal y persona (para no leídas)
create table if not exists chat_reads (
  channel_id   uuid not null references chat_channels(id) on delete cascade,
  user_id      uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

-- Canal general por defecto (si aún no hay ninguno)
insert into chat_channels (name, kind, topic)
select 'general', 'channel', 'Canal del equipo'
where not exists (select 1 from chat_channels);

-- ============================================================
-- Storage: bucket 'chat-uploads' para fotos y documentos.
-- Créalo en el panel de Supabase → Storage → New bucket:
--   name = chat-uploads   ·   Public = ON
-- (La API sube con la service role; el bucket público sirve las URLs.)
-- ============================================================


-- ===== copy_trading.sql =====

-- Onyx Copy Trading · esquema Fase 1
-- Enlaces master→esclava, cola de comandos y log. Ejecutar en Supabase SQL Editor.

create table if not exists public.copy_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  master_account_id uuid not null,
  slave_account_id uuid not null,
  mode text not null default 'balance',        -- balance | risk | pips | fixed
  multiplier numeric not null default 1,
  risk_pct numeric not null default 1,          -- para mode=risk (% del balance)
  pip_risk numeric not null default 20,         -- para mode=pips
  max_lot numeric not null default 50,
  reverse boolean not null default false,
  symbol_map jsonb not null default '{}'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  humanize jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (master_account_id, slave_account_id)
);
create index if not exists copy_links_owner on public.copy_links(owner_id);
create index if not exists copy_links_master on public.copy_links(master_account_id) where enabled;

create table if not exists public.copy_commands (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.copy_links(id) on delete cascade,
  slave_account_id uuid not null,
  action text not null,                          -- open | close | modify
  master_ticket text,
  base_symbol text,
  side text,                                     -- buy | sell
  volume_hint numeric,
  sl numeric, tp numeric, price numeric,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',        -- pending | done | failed | skipped
  error text,
  created_at timestamptz not null default now(),
  taken_at timestamptz, done_at timestamptz
);
create index if not exists copy_commands_queue on public.copy_commands(slave_account_id, status, created_at);

create table if not exists public.copy_log (
  id bigserial primary key,
  owner_id uuid not null,
  link_id uuid,
  kind text not null,                            -- copied | closed | skipped | error | modify
  symbol text,
  detail jsonb not null default '{}'::jsonb,
  ok boolean not null default true,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists copy_log_owner on public.copy_log(owner_id, created_at desc);

-- Esclavas extra compradas como add-on (por encima del límite del plan).
alter table if exists public.profiles
  add column if not exists extra_slaves int not null default 0;

-- RLS: el acceso a estas tablas va por el service role (supabaseAdmin) desde el backend,
-- igual que el resto de tablas de Onyx. No se exponen directamente al cliente.


-- ===== copy_v2.sql =====

-- (Para el plan tope "Black Onyx" corre además supabase/black_onyx.sql)
-- Onyx Copy Trading · esquema Fase 2
-- Añade: claves Copy identificadas (separadas de Guardian), interruptores de
-- pausa (global / por cuenta / por enlace ya existe), PIN de copy para reanudar,
-- y controles de riesgo por enlace. Ejecutar en Supabase SQL Editor.
-- Todo con "if not exists": es seguro repetirlo.

-- 1) Claves identificadas: guardian (sync normal) vs copy (copy trading).
--    Las claves existentes quedan como 'guardian' por defecto.
alter table if exists public.api_keys
  add column if not exists kind text not null default 'guardian';   -- guardian | copy
create index if not exists api_keys_kind on public.api_keys(user_id, kind) where revoked = false;

-- El índice único viejo era (user_id, account_login) y NO dejaba tener a la vez
-- la clave Guardian y la clave Copy de la MISMA cuenta. Lo recreamos incluyendo
-- 'kind' para permitir una de cada tipo por cuenta.
drop index if exists api_keys_user_login_idx;
create unique index if not exists api_keys_user_login_kind_idx
  on public.api_keys (user_id, account_login, kind)
  where account_login is not null and revoked = false;

-- 2) Interruptores de copia (control remoto desde web/Telegram).
--    Pausa GLOBAL del trader (kill switch) + PIN para reanudar.
alter table if exists public.profiles
  add column if not exists copy_paused boolean not null default false,
  add column if not exists copy_pin_hash text,                       -- pbkdf2, opcional
  add column if not exists copy_paused_at timestamptz;

--    Pausa por CUENTA (una master o una esclava concreta).
alter table if exists public.trading_accounts
  add column if not exists copy_paused boolean not null default false;

--    Preferencias de avisos por Telegram del copy trading.
alter table if exists public.profiles
  add column if not exists tg_copy_paused boolean not null default true,   -- copia pausada / reanudada
  add column if not exists tg_copy_error  boolean not null default true;   -- fallo al copiar (símbolo, spread, etc.)

--    Cuentas Master extra compradas como add-on (por encima de la base del plan).
alter table if exists public.profiles
  add column if not exists extra_masters int not null default 0;

-- 3) Controles de riesgo por enlace (se configuran desde el tab, no en la EA).
--    El servidor aplica sesión y whitelist (no crea el comando); la EA esclava
--    aplica lote/spread/pérdida diaria/drawdown en su lado.
alter table if exists public.copy_links
  add column if not exists daily_loss_pct  numeric not null default 0,   -- 0 = sin límite
  add column if not exists max_drawdown_pct numeric not null default 0,  -- 0 = sin límite
  add column if not exists max_spread       numeric not null default 0,  -- puntos; 0 = sin límite
  add column if not exists session_from     text,                        -- "HH:MM" UTC, null = 24h
  add column if not exists session_to       text,
  add column if not exists symbol_whitelist jsonb not null default '[]'::jsonb; -- [] = todos

-- 4) Registro de acciones de control (auditoría de pausar/reanudar).
create table if not exists public.copy_control_log (
  id bigserial primary key,
  owner_id uuid not null,
  action text not null,                 -- pause_all | resume_all | pause_account | resume_account | pause_link | resume_link
  target text,                          -- id de cuenta o enlace afectado
  source text not null default 'web',   -- web | telegram | auto
  created_at timestamptz not null default now()
);
create index if not exists copy_control_log_owner on public.copy_control_log(owner_id, created_at desc);


-- ===== copy_v3.sql =====

-- ============================================================
-- Copy v3 · envelope de riesgo completo por enlace (todo ON por defecto).
-- El trader apaga lo que no quiere (0 = off). require_sl es booleano.
-- ============================================================
alter table if exists public.copy_links
  add column if not exists max_deviation_pts  numeric  not null default 20,   -- desvío máx de entrada (pts). 0 = off
  add column if not exists max_signal_age_s   numeric  not null default 30,   -- antigüedad máx de la señal (s). 0 = off
  add column if not exists require_sl          boolean  not null default true, -- exigir Stop Loss para copiar
  add column if not exists max_positions       integer  not null default 20,   -- máx posiciones abiertas por copia. 0 = off
  add column if not exists per_symbol_lot_cap  numeric  not null default 0;    -- tope de lote acumulado por símbolo. 0 = usa max_lot

-- Nuevos enlaces nacen con protección encendida (sensata):
alter table if exists public.copy_links alter column daily_loss_pct   set default 5;
alter table if exists public.copy_links alter column max_drawdown_pct set default 10;
alter table if exists public.copy_links alter column max_spread       set default 30;


-- ===== diagnostics_v1.sql =====

-- ============================================
-- Onyx Trading Live · Diagnóstico: registro de errores
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Cada error del servidor aterriza aquí, con una explicación en lenguaje claro.
create table if not exists app_errors (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,          -- de dónde vino: ea_sync | support_ai | mail | telegram | ...
  code        text,                   -- HTTP 404, 308, timeout, etc. (si aplica)
  message     text not null,          -- el error técnico
  hint        text,                   -- explicación/qué hacer, en claro
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists app_errors_time_idx on app_errors (created_at desc);
create index if not exists app_errors_source_idx on app_errors (source, created_at desc);

notify pgrst, 'reload schema';


-- ===== email_log.sql =====

-- Registro de correos que ENVÍA el sistema (bandeja de salida + por usuario).
-- Cada envío por Resend deja una fila aquí. Correr una vez. Idempotente.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text,
  kind text,                 -- billing | admin | support | challenge | ...
  status text default 'sent',-- sent | failed
  user_id uuid,              -- opcional
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists email_log_to on public.email_log (to_email, created_at desc);
create index if not exists email_log_at on public.email_log (created_at desc);

alter table public.email_log enable row level security;


-- ===== entregaA.sql =====

-- ============================================================
-- Onyx · ENTREGA A: centro de cuentas
-- Tipo de cuenta, estado del challenge, coste, retiros/pagos y documentos.
-- Ejecuta en Supabase → SQL Editor (proyecto aohupkoamqnmeyqduuxa). Seguro de re-ejecutar.
-- ============================================================

-- Campos nuevos en la cuenta
alter table trading_accounts add column if not exists acc_type         text;    -- challenge | funded | own | demo
alter table trading_accounts add column if not exists challenge_status text;    -- running | passed | failed
alter table trading_accounts add column if not exists challenge_cost   numeric; -- lo que pagaste por el reto

-- Retiros / pagos recibidos por cuenta
create table if not exists payouts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  account_id  uuid not null references trading_accounts(id) on delete cascade,
  amount      numeric not null default 0,
  date        date,
  note        text,
  receipt_url text,
  created_at  timestamptz default now()
);
alter table payouts enable row level security;
drop policy if exists "own payouts" on payouts;
create policy "own payouts" on payouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_payouts_user on payouts(user_id);
create index if not exists idx_payouts_acc  on payouts(account_id);

-- Documentos por cuenta (certificados, comprobantes, facturas…)
create table if not exists account_documents (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references trading_accounts(id) on delete cascade,
  doc_type   text not null default 'certificate',  -- certificate | payout | invoice | kyc | other
  title      text,
  image_url  text,
  created_at timestamptz default now()
);
alter table account_documents enable row level security;
drop policy if exists "own docs" on account_documents;
create policy "own docs" on account_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_docs_user on account_documents(user_id);
create index if not exists idx_docs_acc  on account_documents(account_id);

notify pgrst, 'reload schema';


-- ===== expenses.sql =====

-- ============================================================
-- Balance real: gastos operacionales del trader (retos, VPS, software…).
-- Correr una vez en Supabase. Idempotente.
-- ============================================================
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'other',   -- funding|vps|software|data|internet|journal|education|fees|other
  label text,                                -- texto libre si category='other'
  amount numeric not null default 0,
  currency text default 'USD',
  spent_on date not null default current_date,
  recurring boolean not null default false,  -- true = mensual (cuenta cada mes desde spent_on)
  note text,
  created_at timestamptz not null default now()
);
create index if not exists expenses_user_idx on public.expenses (user_id, spent_on desc);
alter table public.expenses enable row level security;

-- La sección "Balance real" se muestra a los planes con la capacidad "expenses".
-- Actívala en Admin → Planes/Módulos (Capacidades) para Pro, Elite y Black Onyx.
-- Ejemplo directo por SQL (opcional):
--   update public.plans set capabilities = coalesce(capabilities,'{}'::jsonb) || '{"expenses":true}'
--   where id in ('pro','elite','black');


-- ===== expenses_v2.sql =====

-- ============================================================
-- Balance real v2: campos de prop firm, reembolso, cuenta y proveedor.
-- Corre esto DESPUÉS de expenses.sql. Idempotente.
-- ============================================================
alter table public.expenses add column if not exists firm text;         -- FTMO, The5ers, MyFundedFX… (solo fondeo)
alter table public.expenses add column if not exists acc_size numeric;    -- tamaño de la cuenta de reto
alter table public.expenses add column if not exists phase text;          -- p1 | p2 | funded | reset
alter table public.expenses add column if not exists account_id uuid references public.trading_accounts(id) on delete set null;
alter table public.expenses add column if not exists refundable boolean not null default false; -- la firma devuelve la tarifa
alter table public.expenses add column if not exists recovered numeric not null default 0;       -- cuánto se recuperó ya
alter table public.expenses add column if not exists provider text;       -- Contabo, TradingView… (cualquier categoría)


-- ===== helpdesk_v1.sql =====

-- ============================================
-- Onyx Trading Live · Equipo robusto + Helpdesk
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- (después de support_v1.sql y support_v2.sql)
-- ============================================

-- Permisos a la carta por miembro (además del rol), disponibilidad para el chat
-- y última actividad.
alter table profiles add column if not exists perms       jsonb not null default '{}'::jsonb;
alter table profiles add column if not exists available   boolean not null default false;
alter table profiles add column if not exists last_active timestamptz;

-- Asignación de conversaciones y canal de origen
alter table support_tickets add column if not exists assignee_id uuid references auth.users(id) on delete set null;
alter table support_tickets add column if not exists channel     text not null default 'ticket';   -- ticket | chat | lead | email
create index if not exists support_tickets_assignee_idx on support_tickets (assignee_id, updated_at desc);

-- Colaboradores invitados a una conversación
create table if not exists ticket_participants (
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  added_at  timestamptz not null default now(),
  primary key (ticket_id, user_id)
);

-- Nota: los mensajes internos del equipo se guardan en support_messages con
-- sender = 'note' (no se muestran al trader).

notify pgrst, 'reload schema';


-- ===== kb_v1.sql =====

-- ============================================
-- Onyx Trading Live · Base de conocimiento editable para Onyx AI
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Artículos que escribes desde el Admin y que la IA lee además de la Guía.
create table if not exists kb_articles (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  tags        text default '',        -- palabras clave separadas por coma (para la búsqueda)
  published   boolean not null default true,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists kb_articles_pub_idx on kb_articles (published, updated_at desc);

notify pgrst, 'reload schema';


-- ===== manager_v1.sql =====

-- ============================================
-- Onyx Manager · Fase 1 (núcleo)
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Configuración del gestor por cuenta de trading
create table if not exists manager_configs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references trading_accounts(id) on delete cascade,
  enabled boolean not null default false,
  units text not null default 'pips',        -- pips | r | money
  config jsonb not null default '{}'::jsonb, -- breakeven, trailing, partials
  version int not null default 1,            -- sube en cada cambio; el EA la compara
  updated_at timestamptz default now(),
  unique (account_id)
);

-- Plantillas reutilizables del trader ("Mi setup FTMO")
create table if not exists manager_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  units text not null default 'pips',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Qué hizo el EA, cuándo y por qué
create table if not exists manager_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  account_id uuid references trading_accounts(id) on delete cascade,
  kind text not null,        -- breakeven | trailing | partial | close_all | blocked | info
  detail text,
  symbol text,
  ticket bigint,
  amount numeric,
  created_at timestamptz default now()
);

-- Cola de acciones rápidas que el EA recoge en su siguiente sync
create table if not exists manager_commands (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references trading_accounts(id) on delete cascade,
  command text not null,     -- close_all | close_profitable | close_losing | close_half | sl_to_be
  params jsonb default '{}'::jsonb,
  status text not null default 'pending',  -- pending | done | expired
  created_at timestamptz default now(),
  done_at timestamptz
);

-- El EA nos dice en qué hora vive su servidor (para convertir horarios más adelante)
alter table trading_accounts add column if not exists server_offset int;
alter table trading_accounts add column if not exists ea_version text;

create index if not exists manager_events_acc_idx on manager_events (account_id, created_at desc);
create index if not exists manager_commands_pending_idx on manager_commands (account_id, status);

-- Capacidades nuevas por plan (el gestor básico en Pro, el avanzado en Elite)
update plans set capabilities = capabilities
  || '{"manager": true}'::jsonb
  where id in ('pro', 'elite');
update plans set capabilities = capabilities
  || '{"manager_advanced": true}'::jsonb
  where id = 'elite';
update plans set capabilities = capabilities
  || '{"manager": false, "manager_advanced": false}'::jsonb
  where id = 'free';

notify pgrst, 'reload schema';


-- ===== manager_v2.sql =====

-- ============================================
-- Onyx Manager · Fase 2 (mi plan de trading, límites, noticias, disciplina)
-- Ejecuta este archivo completo en Supabase → SQL Editor.
-- Es seguro repetirlo: todo va con "if not exists".
-- ============================================

-- ------------------------------------------------------------
-- 1) Estado del día por cuenta
-- El EA manda su hora de servidor y aquí anclamos el día: con qué balance
-- empezó, cuántas operaciones lleva, si está bloqueado y hasta cuándo.
-- Es la fuente de la verdad; el EA solo obedece.
-- ------------------------------------------------------------
create table if not exists manager_state (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references trading_accounts(id) on delete cascade,

  day_key text,                 -- 'YYYY-MM-DD' del día del bróker ya corregido por reset_hour
  day_start_balance numeric,    -- balance al arrancar el día
  day_start_equity numeric,     -- equity al arrancar el día
  initial_balance numeric,      -- balance la primera vez que vimos la cuenta

  trades_today int not null default 0,
  losses_streak int not null default 0,      -- pérdidas seguidas (para el freno de tilt)
  last_loss_at timestamptz,                  -- para el enfriamiento

  blocked boolean not null default false,
  blocked_reason text,                       -- schedule | daily_loss | total_loss | target | tilt | news | max_trades
  blocked_until timestamptz,                 -- null = hasta el próximo día

  override_until timestamptz,                -- si pidió saltarse la regla, hasta cuándo vale
  override_requested_at timestamptz,         -- cuándo lo pidió (la fricción cuenta desde aquí)

  updated_at timestamptz default now(),
  unique (account_id)
);

create index if not exists manager_state_user_idx on manager_state (user_id);

alter table manager_state enable row level security;
drop policy if exists "own manager_state" on manager_state;
create policy "own manager_state" on manager_state for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2) Eventos: añadimos los tipos de la fase 2
-- kind ya existente: breakeven | trailing | partial | close_all | blocked | info
-- nuevos:            override  | limit    | news    | schedule  | tilt
-- (kind es texto, no hace falta migrar nada; esto es solo documentación)
-- ------------------------------------------------------------
alter table manager_events add column if not exists meta jsonb default '{}'::jsonb;
create index if not exists manager_events_kind_idx on manager_events (user_id, kind, created_at desc);

-- ------------------------------------------------------------
-- 3) Plantillas de prop firm editables desde el panel de admin
-- Se guardan en app_settings para que puedas corregirlas sin tocar código
-- cuando una firma cambie sus reglas.
-- ------------------------------------------------------------
insert into app_settings (key, value)
values ('prop_templates', '{"list": []}'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 4) La cuenta guarda qué plantilla aplicó, para poder avisarla si cambia
-- ------------------------------------------------------------
alter table trading_accounts add column if not exists firm_template text;

-- ------------------------------------------------------------
-- 5) Capacidad nueva: el bloqueo por noticias es del plan Elite
-- ------------------------------------------------------------
update plans set capabilities = capabilities || '{"manager_news": true}'::jsonb  where id = 'elite';
update plans set capabilities = capabilities || '{"manager_news": false}'::jsonb where id in ('free', 'pro');

notify pgrst, 'reload schema';


-- ===== matchtrader.sql =====

-- ============================================================
-- MatchTrader (BETA) · conexión por API del broker.
-- MatchTrader no permite instalar EAs; la integración es server-side contra
-- la API REST del broker. Aquí guardamos las credenciales que el trader pega.
-- El motor (lib/matchtrader.ts) reutiliza el MISMO Guardian y Copy que MT/cTrader;
-- solo faltan por rellenar 3 llamadas a la API real del broker (ver el TODO).
-- ============================================================
create table if not exists public.matchtrader_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.trading_accounts(id) on delete cascade,
  user_id uuid not null,
  api_base text not null,          -- URL base de la API del broker (te la da el broker)
  api_key  text not null,          -- clave/token del broker
  system_uuid text,                -- algunos brokers piden un systemUuid / accountId
  enabled boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mtr_conn_user on public.matchtrader_connections(user_id);
create index if not exists mtr_conn_acc  on public.matchtrader_connections(account_id) where enabled;
alter table public.matchtrader_connections enable row level security;


-- ===== notifications.sql =====

-- ============================================================
-- Centro de mensajes del trader (notificaciones dentro de la app).
-- Correr una vez en Supabase. Idempotente.
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text default 'info',          -- info | support | funding | manager | goal | offline
  title text not null,
  body text,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;


-- ===== notify_marketing_default_on.sql =====

-- =====================================================================
--  "Novedades y ofertas" (notify_marketing) activado por defecto.
--  · Las cuentas NUEVAS nacen con el toggle encendido.
--  · Los usuarios que NUNCA lo tocaron (null) quedan encendidos.
--  · A quien lo apagó a propósito (false) NO se le toca.
-- =====================================================================

alter table profiles alter column notify_marketing set default true;
update profiles set notify_marketing = true where notify_marketing is null;


-- ===== onboarding_guide.sql =====

-- Guía de configuración adaptativa: guarda, por cuenta, qué quiere hacer el
-- trader con ella (diario / guardian / copy / tradingview). Sirve para saber
-- qué pasos mostrarle. La finalización de cada paso se detecta en vivo.
alter table public.trading_accounts add column if not exists onboard jsonb not null default '{}'::jsonb;


-- ===== onboarding_v1.sql =====

-- ============================================
-- Onyx Trading Live · Perfil del trader (onboarding)
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Datos del perfil de trader que se piden una vez, tras confirmar el email.
alter table profiles add column if not exists country     text;
alter table profiles add column if not exists experience  text;   -- novato | intermedio | avanzado | pro
alter table profiles add column if not exists trade_style text;   -- scalping | day | swing | position
alter table profiles add column if not exists platform    text;   -- mt4 | mt5 | ambas
alter table profiles add column if not exists prop_firm    text;   -- nombre de la prop firm, o 'ninguna'
alter table profiles add column if not exists goal        text;   -- pasar_challenge | consistencia | crecer | vivir

-- Marca de que el usuario ya vio el onboarding (aunque lo haya saltado).
-- Si es null, se le muestra la pantalla una vez.
alter table profiles add column if not exists onboarded_at timestamptz;

notify pgrst, 'reload schema';


-- ===== onyx_connect.sql =====

-- ============================================================
-- Onyx Connect — un solo EA que reporta su estado.
-- Añade a trading_accounts:
--   · trade_allowed : si el AutoTrading de MetaTrader está ENCENDIDO
--                     (el EA puede ejecutar: Guardian, Copy, TradingView).
--   · spread        : spread en vivo (en puntos) que reporta el EA.
-- Correr una sola vez en el editor SQL de Supabase. Es seguro re-ejecutar.
-- ============================================================

alter table if exists public.trading_accounts
  add column if not exists trade_allowed boolean,
  add column if not exists spread numeric;

-- (opcional) un índice no hace falta; son columnas de estado por cuenta.


-- ===== onyx_finanzas.sql =====

-- Finanzas de Onyx (P&L del negocio). Ejecutar en el SQL Editor de Supabase.
-- Solo la ve el dueño (o a quien conceda el permiso 'finanzas' en Equipo).
-- Los ingresos se leen de Stripe; aquí solo guardamos los GASTOS del negocio.

create table if not exists public.onyx_expenses (
  id uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'otros',   -- infra | sueldos | ads | herramientas | legal | otros
  amount      numeric not null default 0,       -- importe (en la moneda del negocio)
  kind        text not null default 'recurring',-- recurring | one_off
  interval    text not null default 'monthly',  -- monthly | yearly  (solo para recurring)
  incurred_on date not null default (now() at time zone 'utc')::date, -- fecha (puntual) o inicio (recurrente)
  ends_on     date,                             -- fin opcional de un gasto recurrente (null = activo)
  active      boolean not null default true,    -- apagar sin borrar
  vendor      text,                             -- proveedor (Vercel, Supabase…)
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists onyx_expenses_kind on public.onyx_expenses (kind);
create index if not exists onyx_expenses_date on public.onyx_expenses (incurred_on);

-- La caja (saldo actual del negocio) se guarda en app_settings con la clave 'onyx_cash'
-- mediante lib/settings (getSetting/saveSetting), así que no hace falta tabla extra.


-- ===== optimize_v1.sql =====

-- Afinado de la base de datos. La app llama a esta función para que Postgres
-- recalcule estadísticas y las consultas sigan siendo rápidas al crecer.
-- Tolerante: si una tabla aún no existe, no rompe.
create or replace function public.optimize_maintenance()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  begin analyze public.trades; exception when others then null; end;
  begin analyze public.trading_accounts; exception when others then null; end;
  begin analyze public.profiles; exception when others then null; end;
  begin analyze public.support_tickets; exception when others then null; end;
  begin analyze public.support_messages; exception when others then null; end;
  begin analyze public.app_errors; exception when others then null; end;
  begin analyze public.telegram_log; exception when others then null; end;
end;
$$;

revoke all on function public.optimize_maintenance() from public;


-- ===== optimize_v2.sql =====

-- Tamaño de la base y de cada tabla, para la pestaña Optimización.
-- SECURITY DEFINER: lo llama la app con la clave de servicio.

create or replace function public.db_total_size()
returns bigint
language sql security definer set search_path = public
as $$ select pg_database_size(current_database()); $$;

create or replace function public.db_table_sizes()
returns table(name text, bytes bigint, rows bigint)
language sql security definer set search_path = public
as $$
  select c.relname::text,
         pg_total_relation_size(c.oid)::bigint,
         greatest(c.reltuples, 0)::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc
  limit 8;
$$;

revoke all on function public.db_total_size() from public;
revoke all on function public.db_table_sizes() from public;


-- ===== phase3.sql =====

-- ============================================================
-- Onyx · FASE 3: diario por operación (notas, etiquetas, fotos) + reglas de fondeo
-- Ejecuta en Supabase → SQL Editor (proyecto aohupkoamqnmeyqduuxa)
-- Seguro de re-ejecutar.
-- ============================================================

-- Diario por operación
create table if not exists trade_journal (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  trade_id   uuid not null references trades(id) on delete cascade,
  notes      text,
  tags       text[] not null default '{}',
  emotion    text,
  image_url  text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (trade_id)
);

alter table trade_journal enable row level security;
drop policy if exists "own journal" on trade_journal;
create policy "own journal" on trade_journal for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_journal_user on trade_journal(user_id);

-- Reglas de fondeo por cuenta (opcionales, editables desde el dashboard)
alter table trading_accounts add column if not exists fund_target    numeric;  -- objetivo de profit ($)
alter table trading_accounts add column if not exists fund_max_daily numeric;  -- pérdida diaria máx ($)
alter table trading_accounts add column if not exists fund_max_total numeric;  -- pérdida total máx ($)
alter table trading_accounts add column if not exists fund_start     numeric;  -- balance inicial ($)

notify pgrst, 'reload schema';


-- ===== plan_change.sql =====

-- ============================================================
-- Cambio de plan PROGRAMADO (downgrade diferido) + avisos.
--
-- Filosofía: bajar de plan NUNCA quita funciones al instante. El trader
-- conserva lo que pagó hasta que expira el periodo; en esa fecha baja el plan
-- (Stripe Subscription Schedule) y recién ahí se pausan las funciones sobrantes.
--
-- Correr una vez en Supabase (SQL editor). Es idempotente.
-- ============================================================

-- --- profiles: estado del cambio pendiente ---
alter table profiles add column if not exists pending_plan        text;            -- plan al que bajará
alter table profiles add column if not exists pending_plan_at     timestamptz;     -- cuándo aplica (fin de periodo)
alter table profiles add column if not exists pending_schedule_id text;            -- id del Subscription Schedule (para cancelar)
alter table profiles add column if not exists pending_notified_3d boolean default false;  -- ya se avisó 3 días antes
alter table profiles add column if not exists pending_keep        jsonb;           -- ids de cuentas a conservar (elección del trader)

-- --- trading_accounts: cuenta pausada por límite de plan ---
-- No se borra: si vuelve a subir de plan, se reactiva.
alter table trading_accounts add column if not exists plan_paused boolean default false;

-- Aviso de facturación por Telegram (independiente de la capacidad Telegram del plan)
alter table profiles add column if not exists tg_billing boolean default true;


-- ===== plan_v1.sql =====

-- ============================================================
-- Mi plan y hábitos: el plan de trading escrito por el trader + check-in diario.
-- Convive con el Guardian (que impone las reglas duras en el EA). Idempotente.
-- ============================================================

-- El plan (uno por usuario). Se guarda como jsonb para dar cabida a cualquier
-- estilo de trader (scalper, day, swing, fondeo, cripto…) y reglas propias.
create table if not exists trading_plans (
  user_id    uuid primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Check-in diario: qué hábitos cumplió ese día + una nota.
create table if not exists plan_checkins (
  user_id    uuid not null,
  day        date not null,
  items      jsonb not null default '{}'::jsonb,   -- { habitKey: true/false }
  note       text,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists plan_checkins_user_idx on plan_checkins (user_id, day);


-- ===== push.sql =====

-- Suscripciones de notificaciones push (Web Push).
-- Cada navegador/dispositivo del usuario guarda aquí su "endpoint" + claves.
-- Correr una vez en Supabase. Idempotente.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz not null default now(),
  unique (endpoint)
);
create index if not exists push_subs_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subs" on public.push_subscriptions;
create policy "own push subs" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ===== referral_v1.sql =====

-- ============================================================
-- "Invita y gana": programa de referidos para el USUARIO COMÚN (self-serve,
-- recompensa en crédito de cuenta). Convive con Embajadores (que es en efectivo
-- y aprobado). Idempotente.
-- ============================================================

-- Cada usuario tiene su propio código de referido y a quién lo trajo (miembro).
alter table if exists profiles add column if not exists ref_code      text;
alter table if exists profiles add column if not exists member_ref_by uuid;   -- id del usuario que lo invitó
create unique index if not exists profiles_ref_code_uidx on profiles (ref_code) where ref_code is not null;

-- Recompensas de referido (una fila por beneficiario). El crédito se aplica al
-- customer de Stripe pasada la ventana anti-abuso; se anula si hay reembolso.
create table if not exists member_rewards (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null,           -- quien invita
  referred_id  uuid not null,           -- el amigo que pagó
  beneficiary  uuid not null,           -- a quién se le acredita (referrer o referred)
  kind         text not null,           -- 'referrer' | 'friend'
  invoice_id   text,                    -- factura que disparó la recompensa
  amount       numeric not null,        -- crédito en la moneda base
  currency     text not null default 'USD',
  status       text not null default 'pending',   -- pending | applied | reversed
  available_at timestamptz not null default now(),
  applied_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists member_rewards_benef_idx on member_rewards (beneficiary, status);
create index if not exists member_rewards_due_idx   on member_rewards (status, available_at);
-- Un referido solo genera recompensa una vez (su primer pago).
create unique index if not exists member_rewards_once_uidx on member_rewards (referred_id, kind);


-- ===== retention_v1.sql =====

-- ============================================
-- Onyx Trading Live · Retención y complementos
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Cada intento de cancelación, con su motivo y en qué acabó
create table if not exists cancellations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  plan text,
  reason text,                 -- price | unused | missing | stopped | other
  detail text,                 -- lo que escriba el usuario
  outcome text not null default 'pending',  -- pending | saved_discount | saved_pause | saved_downgrade | canceled
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index if not exists cancellations_created_idx on cancellations (created_at desc);

-- Cuentas MT extra compradas como complemento
alter table profiles add column if not exists extra_accounts int not null default 0;

-- Reglas de retención (editables desde el panel)
insert into app_settings (key, value) values ('retention', '{
  "enabled": true,
  "discount_percent": 50,
  "discount_months": 3,
  "pause_months": 2,
  "allow_downgrade": true
}'::jsonb) on conflict (key) do nothing;

-- Complementos de pago
insert into app_settings (key, value) values ('addons', '{
  "extra_account_enabled": true,
  "extra_account_price": 4,
  "extra_account_price_id": ""
}'::jsonb) on conflict (key) do nothing;

notify pgrst, 'reload schema';


-- ===== retention_v2.sql =====

-- ============================================================
-- Retención anti-abuso: registro de descuentos concedidos + bloqueo.
-- Cierra el bucle de "cancelar cada 3 meses para farmear el 40%".
-- Idempotente.
-- ============================================================

-- Cada descuento de rescate concedido queda registrado (para cooldown, tope de
-- veces por usuario y tope global mensual).
create table if not exists retention_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  email       text,
  tier        int  not null default 1,   -- 1 = primera vez, 2 = repetida, …
  percent     int  not null,
  months      int  not null,
  created_at  timestamptz not null default now()
);
create index if not exists retention_grants_user_idx on retention_grants (user_id, created_at);
create index if not exists retention_grants_month_idx on retention_grants (created_at);

-- Si alguien toma el descuento y cancela dentro de la ventana, queda inelegible.
alter table if exists profiles add column if not exists retention_blocked boolean default false;


-- ===== rls_lockdown.sql =====

-- ============================================================
-- BLINDAJE RLS  ·  Auditoría de seguridad
--
-- Problema: la clave anónima de Supabase es PÚBLICA. Cualquier tabla SIN
-- Row Level Security (RLS) activado queda expuesta: se podría leer/escribir
-- directamente contra la API REST de Supabase, saltándose tu app.
--
-- Solución: activar RLS en TODAS las tablas. Onyx nunca lee datos desde el
-- navegador (solo login/2FA); todo pasa por el servidor con el ROL DE SERVICIO,
-- que IGNORA la RLS. Por eso activar RLS sin políticas = "nadie entra con la
-- clave anónima" y la app sigue funcionando exactamente igual.
--
-- Correr UNA vez en Supabase (SQL editor). Es idempotente y seguro.
-- Si en el futuro necesitas que el navegador lea alguna tabla directamente,
-- se le añade una política concreta (auth.uid() = user_id).
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'account_documents','admin_log','ambassador_payouts','ambassadors','api_keys',
    'app_errors','app_settings','cancellations','commissions','copy_commands',
    'copy_control_log','copy_links','copy_log','kb_articles','manager_commands',
    'manager_configs','manager_events','manager_state','manager_templates','open_positions',
    'payouts','plans','profiles','push_subscriptions','ref_clicks','referrals',
    'support_messages','support_tickets','telegram_log','ticket_participants',
    'trade_journal','trades','trading_accounts'
  ]
  loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('alter table public.%I enable row level security;', t);
    end if;
  end loop;
end $$;

-- Nota: NO añadimos "force row level security" para que el rol de servicio
-- (tu backend) siga teniendo acceso total, que es como funciona la app.


-- ===== support_helpdesk.sql =====

-- ============================================================
-- Helpdesk de soporte: prioridad de ticket + respuestas guardadas.
-- Correr una sola vez en el SQL Editor de Supabase.
-- Todo es idempotente (se puede correr de nuevo sin romper nada).
-- ============================================================

-- 1) Prioridad del ticket: low | normal | high  (por defecto normal)
alter table support_tickets add column if not exists priority text default 'normal';

-- 2) Respuestas guardadas (canned responses) que el equipo reutiliza
create table if not exists support_canned (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  lang        text not null default 'es',   -- es | en
  created_by  text,                          -- correo del admin que la creó
  created_at  timestamptz not null default now()
);

-- Solo el backend (service role) las lee/escribe. Bloqueamos el acceso
-- público habilitando RLS sin políticas (service role igual pasa).
alter table support_canned enable row level security;

-- Índice para ordenar por más recientes
create index if not exists support_canned_created_idx on support_canned (created_at desc);

-- 3) Onboarding por correo: registra qué pasos de la secuencia ya recibió cada
--    usuario, para no repetirlos. Ej: {"welcome":"2026-07-27","connect":"..."}
alter table profiles add column if not exists onboarding_emails jsonb not null default '{}'::jsonb;


-- ===== support_v1.sql =====

-- ============================================
-- Onyx Trading Live · Centro de soporte
-- Ejecuta este archivo completo en Supabase → SQL Editor
-- ============================================

-- Un ticket = una consulta del trader. status: open | in_progress | resolved
create table if not exists support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text,
  subject     text not null,
  category    text not null default 'general',   -- general | conexion | facturacion | guardian | instalacion
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on support_tickets (user_id, updated_at desc);
create index if not exists support_tickets_status_idx on support_tickets (status, updated_at desc);

-- Cada mensaje dentro de un ticket. sender: user | admin | ai
create table if not exists support_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references support_tickets(id) on delete cascade,
  sender      text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on support_messages (ticket_id, created_at);

notify pgrst, 'reload schema';


-- ===== support_v2.sql =====

-- ============================================
-- Onyx Trading Live · Soporte v2: leads (visitantes sin cuenta)
-- Ejecuta DESPUÉS de support_v1.sql, en Supabase → SQL Editor
-- ============================================

-- Un lead es un ticket de alguien que aún no tiene cuenta: solo tenemos su
-- correo. Por eso user_id pasa a ser opcional.
alter table support_tickets alter column user_id drop not null;
alter table support_tickets add column if not exists is_lead boolean not null default false;
alter table support_tickets add column if not exists name text;

notify pgrst, 'reload schema';


-- ===== telegram_log.sql =====

-- Registro de envíos de Telegram.
-- Cada vez que el bot manda un mensaje, se guarda una fila aquí.
-- Sirve para las métricas del panel (Módulos): enviados, /estado, fallidos,
-- informes semanales. Sin esta tabla, esas métricas salen en 0 (no rompe nada).

create table if not exists public.telegram_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  kind       text not null default 'message',   -- blocks|limits|manager|funding|daily|offline|goal|weekly|status|message
  ok         boolean not null default true,      -- ¿lo aceptó Telegram?
  error      text,                                -- motivo si falló
  created_at timestamptz not null default now()
);

create index if not exists telegram_log_created_idx on public.telegram_log (created_at desc);
create index if not exists telegram_log_kind_idx    on public.telegram_log (kind);

-- Solo el servidor (service role) escribe/lee. Sin políticas para usuarios.
alter table public.telegram_log enable row level security;


-- ===== telegram_v1.sql =====

-- ============================================
-- Onyx · Telegram (vínculo + preferencias de alertas)
-- Ejecuta este archivo completo en Supabase → SQL Editor.
-- Seguro de repetir: todo va con "if not exists".
-- ============================================

-- Datos del vínculo con Telegram, en el propio perfil
alter table profiles add column if not exists telegram_chat_id   text;      -- id del chat del usuario con el bot
alter table profiles add column if not exists telegram_username   text;      -- @usuario, solo para mostrarlo
alter table profiles add column if not exists telegram_link_code  text;      -- código temporal para vincular
alter table profiles add column if not exists telegram_linked_at   timestamptz;

-- Qué alertas quiere recibir (todo apagado hasta que lo vincule)
alter table profiles add column if not exists tg_alerts        boolean not null default true;  -- interruptor general
alter table profiles add column if not exists tg_blocks        boolean not null default true;  -- el guardian te frenó
alter table profiles add column if not exists tg_limits        boolean not null default true;  -- límite de pérdida / objetivo
alter table profiles add column if not exists tg_manager       boolean not null default false; -- break even, trailing, parciales
alter table profiles add column if not exists tg_funding       boolean not null default true;  -- cerca de una regla de fondeo
alter table profiles add column if not exists tg_daily         boolean not null default false; -- resumen del día

-- Búsqueda rápida por chat_id (el webhook la usa en cada mensaje entrante)
create index if not exists profiles_tg_chat_idx on profiles (telegram_chat_id);
create index if not exists profiles_tg_code_idx on profiles (telegram_link_code);

-- Capacidad por plan: Telegram es de Elite
update plans set capabilities = capabilities || '{"telegram": true}'::jsonb  where id = 'elite';
update plans set capabilities = capabilities || '{"telegram": false}'::jsonb where id in ('free', 'pro');

notify pgrst, 'reload schema';


-- ===== telegram_v1_fix.sql =====

-- ============================================
-- Onyx · Telegram — versión a prueba de fallos
-- ============================================
-- Por qué este archivo: en el editor de Supabase, si una línea del script
-- falla, se revierte TODO el bloque. La versión anterior tocaba
-- plans.capabilities al final; si esa columna no existe o es de otro tipo,
-- abortaba y se llevaba por delante las columnas de profiles.
--
-- Aquí las columnas de Telegram van primero, cada una idempotente, y lo de
-- los planes se hace aparte y con manejo de error para que nunca arrastre.
-- Es seguro ejecutarlo aunque ya hubieras corrido el anterior.
-- ============================================

-- 1) Columnas de vínculo y preferencias en profiles (lo que Telegram necesita)
alter table profiles add column if not exists telegram_chat_id   text;
alter table profiles add column if not exists telegram_username   text;
alter table profiles add column if not exists telegram_link_code  text;
alter table profiles add column if not exists telegram_linked_at  timestamptz;

alter table profiles add column if not exists tg_alerts  boolean not null default true;
alter table profiles add column if not exists tg_blocks  boolean not null default true;
alter table profiles add column if not exists tg_limits  boolean not null default true;
alter table profiles add column if not exists tg_manager boolean not null default false;
alter table profiles add column if not exists tg_funding boolean not null default true;
alter table profiles add column if not exists tg_daily   boolean not null default false;

create index if not exists profiles_tg_chat_idx on profiles (telegram_chat_id);
create index if not exists profiles_tg_code_idx on profiles (telegram_link_code);

-- 2) Capacidad por plan (Telegram = Elite). Envuelto: si plans.capabilities
--    no existiera, avisa pero NO revierte las columnas de arriba.
do $$
begin
  update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"telegram": true}'::jsonb  where id = 'elite';
  update plans set capabilities = coalesce(capabilities, '{}'::jsonb) || '{"telegram": false}'::jsonb where id in ('free', 'pro');
exception when others then
  raise notice 'No se pudo actualizar plans.capabilities (%). Las columnas de Telegram sí se crearon.', sqlerrm;
end $$;

notify pgrst, 'reload schema';

-- 3) Comprobación: debe devolver 10 (las 10 columnas nuevas de profiles)
select count(*) as columnas_telegram_creadas
from information_schema.columns
where table_name = 'profiles'
  and column_name in (
    'telegram_chat_id','telegram_username','telegram_link_code','telegram_linked_at',
    'tg_alerts','tg_blocks','tg_limits','tg_manager','tg_funding','tg_daily'
  );


-- ===== telegram_v2.sql =====

-- ============================================
-- Onyx · Telegram v2 — más tipos de alerta
-- Ejecuta este archivo completo en Supabase → SQL Editor. Seguro de repetir.
-- ============================================

-- Interruptores nuevos en el perfil
alter table profiles add column if not exists tg_offline boolean not null default true;  -- Guardian sin señal
alter table profiles add column if not exists tg_goal    boolean not null default true;  -- objetivo de fondeo / challenge

-- Marca para no repetir avisos "de una vez al día" (funding, offline, daily…).
-- Guarda { "funding": "2026-07-22", "offline": "...", "daily": "..." } por cuenta o global.
alter table profiles add column if not exists tg_sent jsonb not null default '{}'::jsonb;

-- La cuenta recuerda si ya avisamos de que pasó el challenge / llegó al objetivo,
-- para no felicitar cada vez que sincroniza.
alter table trading_accounts add column if not exists goal_notified_at timestamptz;

-- Comprobación: debe devolver 3
select count(*) as columnas_nuevas
from information_schema.columns
where (table_name = 'profiles' and column_name in ('tg_offline','tg_goal','tg_sent'))
   or (table_name = 'trading_accounts' and column_name = 'goal_notified_at');

notify pgrst, 'reload schema';


-- ===== telegram_v3.sql =====

-- ============================================
-- Onyx · Telegram v3 — informe semanal
-- Ejecuta este archivo completo en Supabase → SQL Editor. Seguro de repetir.
-- ============================================

-- Interruptor del informe semanal (apagado por defecto: es opt-in)
alter table profiles add column if not exists tg_weekly boolean not null default false;

-- Comprobación: debe devolver 1
select count(*) as columna_creada
from information_schema.columns
where table_name = 'profiles' and column_name = 'tg_weekly';

notify pgrst, 'reload schema';


-- ===== tg_report.sql =====

-- Preferencia del trader para recibir su reporte de rendimiento por Telegram.
-- Valores: 'off' (por defecto), 'weekly' (cada lunes), 'monthly' (día 1).
alter table if exists public.profiles
  add column if not exists tg_report text not null default 'off';


-- ===== tradingview.sql =====

-- ============================================================
-- TradingView → Onyx → EA (señales que ejecuta tu EA de Copy)
--
-- Idea: una alerta de TradingView manda un webhook a Onyx; Onyx mete un
-- comando en la MISMA cola que ya usa el copy trading (copy_commands), y el
-- EA esclavo que el trader ya tiene instalado lo ejecuta en su cuenta real.
-- No hace falta cambiar el EA ni reinstalar nada.
--
-- Ejecuta este archivo una vez en Supabase (SQL Editor → pegar → Run).
-- ============================================================

-- 1) La cola de comandos ahora admite señales sin enlace de copy (link_id nulo)
alter table public.copy_commands alter column link_id drop not null;
alter table public.copy_commands add column if not exists source text not null default 'copy';   -- copy | tradingview

-- 2) Ajustes de TradingView por cada cuenta conectada
alter table public.trading_accounts add column if not exists tv_token text;                       -- secreto del webhook
alter table public.trading_accounts add column if not exists tv_enabled boolean not null default false;
alter table public.trading_accounts add column if not exists tv_default_lot numeric not null default 0.01;  -- lote si la alerta no manda uno
alter table public.trading_accounts add column if not exists tv_max_lot numeric not null default 0;         -- tope de lote (0 = sin tope)
alter table public.trading_accounts add column if not exists tv_symbols jsonb not null default '[]'::jsonb; -- lista blanca (vacía = todos)
create unique index if not exists trading_accounts_tv_token on public.trading_accounts(tv_token) where tv_token is not null;

-- 3) Registro de señales recibidas (para el historial en el panel)
create table if not exists public.tv_signals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  user_id uuid not null,
  action text, symbol text, lots numeric, sl numeric, tp numeric,
  status text not null default 'queued',   -- queued | rejected
  error text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tv_signals_acc on public.tv_signals(account_id, created_at desc);


-- ===== verificar_manager_v2.sql =====

-- ============================================
-- Comprobar que manager_v2.sql se aplicó bien.
-- No cambia nada: solo mira y te dice qué encontró.
-- ============================================

select
  -- La tabla nueva del estado del día
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'manager_state')            as tabla_manager_state,

  -- Columnas que añadimos
  (select count(*) from information_schema.columns
     where table_name = 'manager_events' and column_name = 'meta')              as columna_meta,
  (select count(*) from information_schema.columns
     where table_name = 'trading_accounts' and column_name = 'firm_template')   as columna_firm_template,

  -- La fila de ajustes para las plantillas de prop firms
  (select count(*) from app_settings where key = 'prop_templates')              as ajuste_prop_templates,

  -- La capacidad nueva: bloqueo por noticias, solo en Elite
  (select count(*) from plans
     where id = 'elite' and capabilities ? 'manager_news')                      as capacidad_noticias_elite,

  -- RLS encendido en la tabla nueva
  (select count(*) from pg_policies
     where tablename = 'manager_state')                                         as politicas_manager_state;

-- Todos los números deben ser 1 (el último puede ser 1 o más).
-- Si alguno sale 0, vuelve a ejecutar supabase/manager_v2.sql entero.


-- ==================================================================
-- Copy v4 · Retraso aleatorio anti-patrón (jitter). Idempotente.
-- ==================================================================
alter table if exists public.copy_links
  add column if not exists jitter_max_s integer not null default 0;
alter table if exists public.copy_commands
  add column if not exists execute_after timestamptz;
create index if not exists idx_copy_commands_slave_due
  on public.copy_commands (slave_account_id, status, execute_after);
