-- Match history tables
-- Run this against your Supabase database

create table if not exists matches (
  id            bigint generated always as identity primary key,
  user_id       text not null,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  duration_secs int,
  starting_life int not null default 20,
  player_count  int not null default 2,
  format        text,
  notes         text,
  created_at    timestamptz not null default now()
);

create index idx_matches_user on matches (user_id, created_at desc);

create table if not exists match_players (
  id             bigint generated always as identity primary key,
  match_id       bigint not null references matches(id) on delete cascade,
  player_name    text not null,
  color          text,
  starting_life  int not null,
  final_life     int not null,
  poison_total   int not null default 0,
  commander_dmg  int not null default 0,
  is_winner      boolean not null default false,
  player_order   int not null default 0
);

create index idx_match_players_match on match_players (match_id);
