-- Create a table for public "profiles"
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  tenant_id uuid default gen_random_uuid(),
  role text default 'user'
);

alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select using (true);

create policy "Users can insert their own profile."
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile."
  on profiles for update using (auth.uid() = id);

-- Set up Realtime!
alter publication supabase_realtime add table profiles;

-- Set up Storage!
-- create policy "Avatar images are publicly accessible."
--   on storage.objects for select using (bucket_id = 'avatars');

-- create policy "Anyone can upload an avatar."
--   on storage.objects for insert with check (bucket_id = 'avatars');