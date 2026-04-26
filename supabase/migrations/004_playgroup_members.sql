create table if not exists playgroup_members (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  name         text not null,
  avatar_color text not null default '#607D8B',
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_playgroup_members_user on playgroup_members (user_id);

alter table playgroup_members enable row level security;

create policy "Users see own playgroup members"
  on playgroup_members for select
  using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

create policy "Users insert own playgroup members"
  on playgroup_members for insert
  with check (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

create policy "Users update own playgroup members"
  on playgroup_members for update
  using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

create policy "Users delete own playgroup members"
  on playgroup_members for delete
  using (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
