-- Create the 'support_agent' role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'support_agent') THEN
        CREATE ROLE support_agent;
    END IF;
END
$$;

-- Grant usage on schema public to support_agent
GRANT USAGE ON SCHEMA public TO support_agent;

-- Grant select on all tables in public schema to support_agent
-- This is a broad grant for support agents to view data across tenants for audit purposes.
-- In a production environment, this might be more granular.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO support_agent;

-- Alter default privileges for future tables
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT SELECT ON TABLES TO support_agent;