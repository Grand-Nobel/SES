-- Create tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    industry TEXT,
    size INT, -- e.g., number of employees
    used_technologies TEXT[], -- e.g., ['Salesforce', 'Google Workspace']
    -- other tenant-specific profile data can be added here
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Comment on table and columns for clarity
COMMENT ON TABLE public.tenants IS 'Stores information about tenants using the platform.';
COMMENT ON COLUMN public.tenants.name IS 'The display name of the tenant.';
COMMENT ON COLUMN public.tenants.industry IS 'Industry the tenant operates in, for recommendation purposes.';
COMMENT ON COLUMN public.tenants.size IS 'Approximate size of the tenant (e.g., employee count).';
COMMENT ON COLUMN public.tenants.used_technologies IS 'Array of technologies or services the tenant is known to use.';

-- Trigger for updated_at (assuming update_updated_at_column function exists from previous migrations)
CREATE TRIGGER handle_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add some initial mock tenant data (optional, for development)
INSERT INTO public.tenants (id, name, industry, size, used_technologies)
VALUES
('a1b2c3d4-e5f6-7777-8888-9999aaaaabbb', 'Test Tenant Alpha', 'SaaS', 50, ARRAY['Google Workspace', 'Slack']),
('b2c3d4e5-f6a7-8888-9999-aaaaabbbcccc', 'Beta Services Inc.', 'E-commerce', 200, ARRAY['Shopify', 'Mailchimp', 'Zendesk']),
('c3d4e5f6-a7b8-9999-aaaa-bbbbccccdddd', 'Gamma Solutions', 'Fintech', 10, ARRAY['Stripe'])
ON CONFLICT (id) DO NOTHING;

-- This is the tenant ID used in mock data in Marketplace.tsx and RecommendationEngine.ts
INSERT INTO public.tenants (id, name, industry, size, used_technologies)
VALUES
('tenant-123-abc', 'Mock Dev Tenant', 'SaaS', 25, ARRAY['Google Workspace', 'Jira'])
ON CONFLICT (id) DO NOTHING;