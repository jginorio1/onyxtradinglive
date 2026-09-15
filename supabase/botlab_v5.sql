-- ============================================================
-- Onyx Bot Lab v5 · verificación automática de USDT on-chain (Ethereum/ERC20).
-- Cada factura recibe un MONTO ÚNICO (base + sufijo de sub-centavos) para poder
-- identificar el pago en la cadena sin procesador. Un cron lee tu wallet en
-- Etherscan, casa el monto y confirma solo. Ejecutar tras botlab_v4.sql.
-- ============================================================

-- Monto EXACTO que el cliente debe enviar (base + sufijo único). Ej: 30.0037.
alter table public.crypto_payments add column if not exists match_amount numeric;
-- Hash de la transacción que el verificador on-chain casó (evita doble uso).
alter table public.crypto_payments add column if not exists matched_hash text;
create index if not exists crypto_payments_match on public.crypto_payments(status, network, match_amount);
