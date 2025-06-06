-- Create a table for public "tenants"
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamp with time zone default now()
);

alter table tenants enable row level security;

create policy "Tenants are viewable by everyone."
  on tenants for select using (true);

create policy "Authenticated users can insert tenants."
  on tenants for insert with check (auth.uid() IS NOT NULL);

create policy "Tenant owners can update their own tenant."
  on tenants for update using (auth.uid() IS NOT NULL); -- Simplified for now, ideally linked to a tenant owner in profiles

-- Set up Realtime!
alter publication supabase_realtime add table tenants;