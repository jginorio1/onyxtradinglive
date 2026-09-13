-- Comisión de Bot Lab por trader (opcional).
-- Si es NULL, ese trader usa la comisión global (bot_lab.fee_pct).
-- Si tiene valor (0–90), Onyx se queda ese % de sus ventas.
alter table profiles add column if not exists botlab_fee_pct numeric;
comment on column profiles.botlab_fee_pct is 'Comisión Onyx (%) propia de este trader en Bot Lab. NULL = usa la global.';
