-- Create a table for public "posts"
create table posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  created_at timestamp with time zone default now()
);

alter table posts enable row level security;

create policy "Posts are viewable by everyone."
  on posts for select using (true);

create policy "Authenticated users can insert posts."
  on posts for insert with check (auth.uid() IS NOT NULL);

create policy "Users can update own posts."
  on posts for update using (auth.uid() = id);

create policy "Users can delete own posts."
  on posts for delete using (auth.uid() = id);

-- Set up Realtime!
alter publication supabase_realtime add table posts;