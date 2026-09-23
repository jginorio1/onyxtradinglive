-- Re-sincronizar historial completo de una cuenta.
-- Cuando el trader pulsa "Re-sincronizar historial" en el dashboard, marcamos
-- la cuenta; el próximo sync del EA lee la orden, reinicia su marca de backfill
-- y vuelve a subir TODAS las operaciones desde el principio. Luego se limpia.
ALTER TABLE trading_accounts
  ADD COLUMN IF NOT EXISTS resync_history boolean NOT NULL DEFAULT false;
