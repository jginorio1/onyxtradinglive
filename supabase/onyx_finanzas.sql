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
