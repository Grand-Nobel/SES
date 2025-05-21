-- Create marketplace_connectors table
CREATE TABLE IF NOT EXISTS public.marketplace_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    service_identifier TEXT NOT NULL UNIQUE, -- e.g., 'google-drive', 'slack', used to map to service_name in integration_connectors
    logo_url TEXT,
    category TEXT,
    vendor TEXT,
    default_auth_config JSONB, -- Default configuration template for auth_config in integration_connectors
    default_api_spec JSONB,    -- Default API spec template for api_spec in integration_connectors
    available_scopes TEXT[],   -- List of scopes this connector might request
    setup_guide_url TEXT,      -- Link to a more detailed setup guide if needed
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Comment on table and columns for clarity
COMMENT ON TABLE public.marketplace_connectors IS 'Stores metadata for connectors available in the marketplace.';
COMMENT ON COLUMN public.marketplace_connectors.service_identifier IS 'Unique identifier for the service this marketplace entry represents (e.g., google-drive).';
COMMENT ON COLUMN public.marketplace_connectors.default_auth_config IS 'A template for the auth_config JSONB when an integration_connector is created from this marketplace entry.';
COMMENT ON COLUMN public.marketplace_connectors.default_api_spec IS 'A template for the api_spec JSONB for new integration_connectors.';

-- Trigger for updated_at
-- Ensure the function exists or create it.
-- This function is often created in an initial migration or a utility script.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_marketplace_connectors_updated_at
BEFORE UPDATE ON public.marketplace_connectors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add some initial mock data (optional, for development)
INSERT INTO public.marketplace_connectors (name, description, service_identifier, logo_url, category, vendor, is_featured, default_auth_config)
VALUES
('Google Drive Basic', 'Connect to Google Drive for basic file access.', 'google-drive-basic', '/icons/google-drive.svg', 'File Storage', 'Google', TRUE, '{"type": "oauth2", "clientId": "YOUR_GOOGLE_CLIENT_ID", "clientSecret": "YOUR_GOOGLE_CLIENT_SECRET", "scopes": ["https://www.googleapis.com/auth/drive.readonly"]}'::jsonb),
('Slack Notifications', 'Receive notifications in your Slack channels.', 'slack-notifications', '/icons/slack.svg', 'Communication', 'Slack', TRUE, '{"type": "oauth2", "clientId": "YOUR_SLACK_CLIENT_ID", "clientSecret": "YOUR_SLACK_CLIENT_SECRET", "scopes": ["chat:write", "incoming-webhook"]}'::jsonb),
('Generic API Key Service', 'Connect to a service using a simple API Key.', 'generic-api-key', '/icons/api.svg', 'Utility', 'Generic Corp', FALSE, '{"type": "apikey", "apiKeyName": "X-API-KEY", "apiKeyValue": "YOUR_API_KEY_HERE"}'::jsonb)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.marketplace_connectors (name, description, service_identifier, logo_url, category, vendor, is_featured, default_auth_config)
VALUES
('Salesforce CRM Sync', 'Synchronize customer data with Salesforce CRM.', 'salesforce-crm', '/icons/salesforce.svg', 'CRM', 'Salesforce', TRUE, '{"type": "oauth2", "clientId": "YOUR_SALESFORCE_CLIENT_ID", "clientSecret": "YOUR_SALESFORCE_CLIENT_SECRET", "authorizationURL": "https://login.salesforce.com/services/oauth2/authorize", "tokenURL": "https://login.salesforce.com/services/oauth2/token", "scopes": ["api", "refresh_token"]}'::jsonb)
ON CONFLICT (name) DO NOTHING;