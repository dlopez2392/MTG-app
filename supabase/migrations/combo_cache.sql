-- Combo cache table
-- Stores enriched combo results keyed by card name.
-- TTL is enforced by expires_at; the API route refreshes stale rows automatically.

create table if not exists combo_cache (
  card_name  text        primary key,
  combos     jsonb       not null default '[]',
  count      integer     not null default 0,
  cached_at  timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Index so expiry checks are fast
create index if not exists combo_cache_expires_at_idx on combo_cache (expires_at);

-- No RLS needed — this table has no user data, accessed only via service role key
