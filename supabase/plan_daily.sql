-- Foto diaria del cumplimiento del plan. Un cron la escribe cada día para tener
-- historial estable (mapa de 30 días, adherencia del mes, racha que no cambia si
-- se re-sincronizan datos). Guarda tanto lo autoreportado como la conducta real.
CREATE TABLE IF NOT EXISTS plan_daily (
  user_id uuid NOT NULL,
  day date NOT NULL,
  adherence int NOT NULL DEFAULT 0,       -- 0..100 del día
  checkin_rate int NOT NULL DEFAULT 0,    -- % de hábitos marcados ese día
  discipline int NOT NULL DEFAULT 0,      -- 100 si respetó el máx ops, 0 si no; -1 = no operó
  blocked int NOT NULL DEFAULT 0,         -- veces que el Guardian lo frenó
  overrode int NOT NULL DEFAULT 0,        -- veces que se saltó el Guardian
  guardian_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS plan_daily_user_day ON plan_daily (user_id, day DESC);
