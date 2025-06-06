-- Alter audit_logs table to align with section 7.5 requirements
ALTER TABLE public.audit_logs RENAME COLUMN user_id TO actor_id;
ALTER TABLE public.audit_logs RENAME COLUMN action TO action_type;
ALTER TABLE public.audit_logs RENAME COLUMN target_resource_type TO entity_type;
ALTER TABLE public.audit_logs RENAME COLUMN target_resource_id TO entity_id;
ALTER TABLE public.audit_logs RENAME COLUMN payload TO metadata;
ALTER TABLE public.audit_logs RENAME COLUMN created_at TO timestamp;

-- Add new column actor_type if it doesn't exist
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_type TEXT;

-- Change entity_id to UUID if it's not already
ALTER TABLE public.audit_logs ALTER COLUMN entity_id TYPE UUID USING entity_id::UUID;

-- Update indexes to reflect new column names
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_target_resource_type_id;
DROP INDEX IF EXISTS idx_audit_logs_created_at;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_id ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_type ON public.audit_logs(actor_type);

-- Enable Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency during development)
DROP POLICY IF EXISTS "Allow tenant access to audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow support_agent to view all audit_logs" ON public.audit_logs;

-- RLS Policy: Restrict access based on tenant_id for authenticated users
CREATE POLICY "Allow tenant access to audit_logs" ON public.audit_logs
FOR SELECT USING (
    auth.uid() IS NOT NULL AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- RLS Policy: Allow 'support_agent' role to view across tenants (under strict audit)
CREATE POLICY "Allow support_agent to view all audit_logs" ON public.audit_logs
FOR SELECT TO "support_agent" USING (
    true -- Support agents can view all logs, subject to external audit controls
);

-- Comments for clarity (update existing comments and add new ones)
COMMENT ON COLUMN public.audit_logs.timestamp IS 'Timestamp when the audit log entry was created in UTC.';
COMMENT ON COLUMN public.audit_logs.actor_type IS 'Type of actor performing the action (e.g., user, system, agent).';
COMMENT ON COLUMN public.audit_logs.actor_id IS 'Identifier of the user or system component performing the action. Can be a user UUID or system identifier.';
COMMENT ON COLUMN public.audit_logs.action_type IS 'A descriptive key for the action performed (e.g., USER_LOGIN, CREATE_CONNECTOR).';
COMMENT ON COLUMN public.audit_logs.entity_type IS 'The type of entity targeted by the action (e.g., "connector", "user").';
COMMENT ON COLUMN public.audit_logs.entity_id IS 'The ID of the entity targeted by the action.';
COMMENT ON COLUMN public.audit_logs.metadata IS 'JSON object containing relevant data about the event, such as request parameters or changes made.';