-- ============================================================
-- Finanzas · registro automático del gasto de IA (Anthropic).
-- Cada llamada de la app a la IA anota tokens y costo estimado aquí. Finanzas
-- lo suma solo al P&L (categoría herramientas / línea "Onyx AI").
-- ============================================================
create table if not exists public.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  feature       text not null,            -- blog | soporte | academia | moderacion | coach | campanas | embajadores | equipo | seo
  model         text,                     -- modelo usado (lo devuelve la API)
  input_tokens  int  not null default 0,
  output_tokens int  not null default 0,
  cost_cents    int  not null default 0,  -- costo estimado en centavos (según precios configurables)
  created_at    timestamptz not null default now()
);
create index if not exists idx_ai_usage_created on public.ai_usage (created_at);
create index if not exists idx_ai_usage_feature on public.ai_usage (feature);
