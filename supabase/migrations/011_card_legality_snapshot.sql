-- 011_card_legality_snapshot.sql
-- Global cache of Scryfall card legalities for ban-list change detection.
-- No RLS: app-layer service-role access only (consistent with existing tables).
create table if not exists card_legality_snapshot (
  scryfall_id text primary key,
  card_name   text not null,
  legalities  jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists idx_card_legality_snapshot_updated
  on card_legality_snapshot (updated_at);
