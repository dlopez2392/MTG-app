-- Trades — user-scoped trade tracking
CREATE TABLE IF NOT EXISTS trades (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Untitled Trade',
  date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  offering      JSONB NOT NULL DEFAULT '[]',
  receiving     JSONB NOT NULL DEFAULT '[]',
  offering_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  receiving_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trades_user ON trades(user_id, created_at DESC);
