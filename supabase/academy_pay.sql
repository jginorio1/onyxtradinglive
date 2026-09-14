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
