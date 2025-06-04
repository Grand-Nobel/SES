-- This is a placeholder for a new Supabase migration script.
-- It demonstrates a backward-compatible change.

-- Add a new table
CREATE TABLE public.new_feature_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add a new column to an existing table (example, replace with actual table)
-- ALTER TABLE public.your_existing_table
-- ADD COLUMN new_column_name TEXT;

-- Create an index for the new table
CREATE INDEX new_feature_data_name_idx ON public.new_feature_data (name);

-- Enable Row Level Security (RLS) for the new table
ALTER TABLE public.new_feature_data ENABLE ROW LEVEL SECURITY;

-- Create a policy for authenticated users to read their own data (example)
CREATE POLICY "Allow authenticated users to read new_feature_data"
ON public.new_feature_data FOR SELECT
TO authenticated
USING (true);

-- Create a policy for authenticated users to insert their own data (example)
-- This would typically involve a tenant_id or user_id column for ownership
-- CREATE POLICY "Allow authenticated users to insert new_feature_data"
-- ON public.new_feature_data FOR INSERT
-- TO authenticated
-- WITH CHECK (auth.uid() = user_id_column);