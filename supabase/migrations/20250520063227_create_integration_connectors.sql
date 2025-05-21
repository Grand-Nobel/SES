CREATE TABLE public.integration_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    connector_name TEXT NOT NULL,
    service_name TEXT NOT NULL, -- e.g., 'google-calendar', 'jira', 'salesforce'
    auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth2', 'apikey', 'basic', 'custom')),
    auth_config JSONB NOT NULL,
    -- Example for 'apikey': {"api_key_name": "X-API-KEY", "key_location": "header", "secret_key_vault_path": "kv/data/tenant_xyz/connector_abc/api_key"}
    -- Example for 'oauth2': {"client_id_vault_path": "...", "client_secret_vault_path": "...", "auth_url": "...", "token_url": "...", "redirect_uri": "..."}
    api_spec JSONB, -- Optional: OpenAPI spec or relevant API metadata
    scopes TEXT[], -- e.g., ['calendar.readonly', 'issues.write']
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_connected_at TIMESTAMPTZ,
    last_error JSONB,
    metadata JSONB, -- For any additional connector-specific information

    CONSTRAINT uq_tenant_connector_name UNIQUE (tenant_id, connector_name),
    CONSTRAINT fk_tenant
        FOREIGN KEY(tenant_id)
        REFERENCES tenants(id) -- Assuming a 'tenants' table exists
        ON DELETE CASCADE
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.integration_connectors ENABLE ROW LEVEL SECURITY;

-- Policies for RLS (examples, adjust based on actual auth model)
CREATE POLICY "Allow individual read access"
ON public.integration_connectors
FOR SELECT
USING (auth.uid() = tenant_id); -- Or based on a role/claim that maps to tenant_id

CREATE POLICY "Allow individual write access"
ON public.integration_connectors
FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Allow individual update access"
ON public.integration_connectors
FOR UPDATE
USING (auth.uid() = tenant_id);

CREATE POLICY "Allow individual delete access"
ON public.integration_connectors
FOR DELETE
USING (auth.uid() = tenant_id);

-- Trigger to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.integration_connectors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_integration_connectors_tenant_id ON public.integration_connectors(tenant_id);
CREATE INDEX idx_integration_connectors_service_name ON public.integration_connectors(service_name);
CREATE INDEX idx_integration_connectors_auth_type ON public.integration_connectors(auth_type);

COMMENT ON COLUMN public.integration_connectors.auth_config IS 'Stores authentication configuration. For API Key, it might include the key name, location (header/query), and vault path for the secret. For OAuth2, client ID/secret vault paths, auth/token URLs, etc.';
COMMENT ON COLUMN public.integration_connectors.api_spec IS 'Optional: Stores relevant parts of an OpenAPI spec or other API metadata for the connected service.';