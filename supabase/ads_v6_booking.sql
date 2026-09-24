-- ============================================================
-- Onyx Ads · Reserva de espacios por CUPO FIJO + calendario (v6)
--
-- Modelo: cada ubicación admite hasta N anunciantes rotando a la vez (cupo
-- editable desde admin). El vendedor reserva un rango de fechas; mientras el
-- cliente no paga, la reserva queda como "hold" temporal (draft con
-- hold_expires_at) y se libera sola si no se paga. Al confirmar el pago, la
-- campaña pasa a 'active' con starts_at/ends_at: si la fecha ya llegó, entra en
-- la rotación en vivo; si es a futuro, queda PROGRAMADA (pickAd sólo la sirve
-- dentro de la ventana). Un cron marca las vencidas como 'expired' y limpia los
-- holds caducados. La comisión del vendedor se acredita en sales_commissions.
-- Todo aditivo: no rompe nada existente.
-- ============================================================

-- Vendedor que vendió el espacio (comisión), importe cobrado al anunciante,
-- caducidad del "hold" (pre-reserva sin pagar) y datos del comprador.
alter table ad_campaigns add column if not exists rep_id           uuid references sales_reps(id) on delete set null;
alter table ad_campaigns add column if not exists sold_amount      numeric default 0;         -- lo que paga el anunciante (base de comisión)
alter table ad_campaigns add column if not exists commission_pct   numeric default 0;         -- % del vendedor congelado al vender
alter table ad_campaigns add column if not exists hold_expires_at  timestamptz;               -- si es draft, se libera al pasar esta hora
alter table ad_campaigns add column if not exists paid_at          timestamptz;               -- cuándo se confirmó el pago
alter table ad_campaigns add column if not exists advertiser_company text default '';
alter table ad_campaigns add column if not exists advertiser_email   text default '';
alter table ad_campaigns add column if not exists booking_note       text default '';
alter table ad_campaigns add column if not exists source             text default '';         -- 'seller' | 'self' | 'admin'

-- Índices para las consultas de disponibilidad (cupo por slot y rango de fechas).
create index if not exists ad_campaigns_slot_status_idx on ad_campaigns (slot_key, status);
create index if not exists ad_campaigns_rep_idx on ad_campaigns (rep_id);
create index if not exists ad_campaigns_window_idx on ad_campaigns (starts_at, ends_at);

-- Nota: los cupos por ubicación, el % de comisión de espacios, los minutos del
-- hold y los días de maduración viven en app_settings->'ads' (JSON), editables
-- desde el panel de admin. No requieren tabla.
