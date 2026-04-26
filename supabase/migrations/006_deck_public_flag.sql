-- Add public flag to decks so users can share deck lists with playgroup friends
ALTER TABLE decks ADD COLUMN IF NOT EXISTS public boolean NOT NULL DEFAULT false;

-- Index for efficient lookup of a user's public decks
CREATE INDEX IF NOT EXISTS idx_decks_public ON decks (user_id) WHERE public = true;
