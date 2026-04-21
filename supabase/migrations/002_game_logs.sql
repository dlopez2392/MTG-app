-- Game logs — user-scoped game tracking with full CRUD
CREATE TABLE IF NOT EXISTS game_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deck_id       TEXT,
  deck_name     TEXT NOT NULL,
  result        TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  format        TEXT,
  player_count  INT NOT NULL DEFAULT 2,
  notes         TEXT,
  opponent_names TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_logs_user ON game_logs(user_id, created_at DESC);
