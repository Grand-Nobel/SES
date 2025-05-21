-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID, -- Can be NULL for system-level actions
    user_id TEXT, -- Can be system identifier (e.g., 'system', 'connector-service') or actual user UUID
    action TEXT NOT NULL, -- e.g., 'CONNECTOR_CREATED', 'USER_LOGIN_FAILED', 'DATA_SYNC_SUCCESS'
    target_resource_type TEXT, -- Optional: e.g., 'connector', 'user', 'tenant_setting'
    target_resource_id TEXT,   -- Optional: ID of the resource affected
    payload JSONB, -- Details of the action, before/after states, parameters, etc.
    ip_address INET, -- Optional: IP address of the requestor
    user_agent TEXT, -- Optional: User agent of the requestor
    status TEXT DEFAULT 'success', -- 'success', 'failure', 'pending'
    error_message TEXT, -- If status is 'failure'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add foreign key constraint to tenants table if it exists and tenant_id is always expected for certain actions
-- This assumes 'tenants' table has an 'id' column of type UUID.
-- Consider if tenant_id should be nullable based on your audit requirements.
-- If tenants table might not exist yet during this migration, this FK should be in a separate migration.
-- For now, assuming tenants table will exist.
ALTER TABLE public.audit_logs
ADD CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id) 
REFERENCES public.tenants(id) ON DELETE SET NULL; -- Or ON DELETE CASCADE if appropriate

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_resource_type_id ON public.audit_logs(target_resource_type, target_resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON public.audit_logs(status);


-- Comments for clarity
COMMENT ON TABLE public.audit_logs IS 'Stores records of significant actions and events within the system for auditing and compliance.';
COMMENT ON COLUMN public.audit_logs.tenant_id IS 'Identifier of the tenant associated with the audited action, if applicable.';
COMMENT ON COLUMN public.audit_logs.user_id IS 'Identifier of the user or system component performing the action.';
COMMENT ON COLUMN public.audit_logs.action IS 'A descriptive key for the action performed (e.g., USER_LOGIN, CREATE_CONNECTOR).';
COMMENT ON COLUMN public.audit_logs.target_resource_type IS 'The type of resource targeted by the action (e.g., "connector", "user").';
COMMENT ON COLUMN public.audit_logs.target_resource_id IS 'The ID of the resource targeted by the action.';
COMMENT ON COLUMN public.audit_logs.payload IS 'JSON object containing relevant data about the event, such as request parameters or changes made.';
COMMENT ON COLUMN public.audit_logs.ip_address IS 'IP address from which the action originated, if applicable.';
COMMENT ON COLUMN public.audit_logs.user_agent IS 'User agent string of the client performing the action, if applicable.';
COMMENT ON COLUMN public.audit_logs.status IS 'Outcome of the action (e.g., success, failure).';
COMMENT ON COLUMN public.audit_logs.error_message IS 'Details of any error if the action status is failure.';
COMMENT ON COLUMN public.audit_logs.created_at IS 'Timestamp when the audit log entry was created.';