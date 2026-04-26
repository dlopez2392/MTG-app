create table if not exists user_profiles (
  id             uuid primary key default gen_random_uuid(),
  user_id        text unique not null,
  display_name   text not null,
  email          text,
  avatar_url     text,
  discoverable   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_user_profiles_user on user_profiles (user_id);
create index if not exists idx_user_profiles_email on user_profiles (email) where discoverable = true;

alter table user_profiles enable row level security;

create policy "Users see own profile"
  on user_profiles for select
  using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

create policy "Users see discoverable profiles"
  on user_profiles for select
  using (discoverable = true);

create policy "Users insert own profile"
  on user_profiles for insert
  with check (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

create policy "Users update own profile"
  on user_profiles for update
  using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Add friend_user_id to playgroup_members
alter table playgroup_members add column if not exists friend_user_id text;
