-- Add is_friend flag to playgroup_members
alter table playgroup_members add column if not exists is_friend boolean not null default false;

-- Add friend_code to user_profiles for in-person friend adds
alter table user_profiles add column if not exists friend_code text unique;

-- Generate friend codes for existing profiles
update user_profiles
set friend_code = 'MTG-' || upper(substr(md5(random()::text), 1, 4))
where friend_code is null;

-- Index for friend code lookups
create index if not exists idx_user_profiles_friend_code on user_profiles (friend_code) where friend_code is not null;

-- Function to auto-generate friend code on new profile insert
create or replace function generate_friend_code()
returns trigger as $$
begin
  if NEW.friend_code is null then
    NEW.friend_code := 'MTG-' || upper(substr(md5(random()::text), 1, 4));
  end if;
  return NEW;
end;
$$ language plpgsql;

create or replace trigger trg_user_profiles_friend_code
  before insert on user_profiles
  for each row execute function generate_friend_code();
