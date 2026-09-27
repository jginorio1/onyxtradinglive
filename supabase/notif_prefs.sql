-- Preferencias de avisos por trader: qué notificaciones quiere en la campana y
-- en el push del móvil. Es un mapa { "<tipo>": { "bell": true, "push": false } }.
-- Vacío = recibe todo lo que el dueño dejó activo globalmente.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
