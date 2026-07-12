-- Phase 3c: Ban-list Watchdog
-- Three tables: web-push subscriptions, detected B&R events, and per-user
-- notifications tying an event to the user's affected decks.
-- App-layer RLS only (service role) — queries always scoped by user_id in code.

-- Web Push subscriptions (one row per browser/device endpoint per user).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

-- Detected ban-list events (deduped across all users by stable id).
CREATE TABLE IF NOT EXISTS banlist_events (
  id            text PRIMARY KEY,          -- stable hash of (source_url | card | format)
  card_name     text NOT NULL,            -- '' for a "review" event
  format        text NOT NULL,
  status        text NOT NULL,            -- 'banned' | 'restricted' | 'unbanned' | 'review'
  announced_at  timestamptz NOT NULL,
  source_url    text NOT NULL,
  source_title  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Per-user notifications: which events affect which of their decks.
CREATE TABLE IF NOT EXISTS banlist_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  event_id    text NOT NULL REFERENCES banlist_events(id),
  deck_ids    text[] NOT NULL DEFAULT '{}',
  seen        boolean NOT NULL DEFAULT false,
  pushed      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS banlist_notif_user_idx ON banlist_notifications (user_id);
