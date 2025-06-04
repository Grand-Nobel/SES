-- Create agent_logs table
CREATE TABLE IF NOT EXISTS public.agent_logs (
    id BIGSERIAL PRIMARY KEY,
    trace_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID NOT NULL,
    user_id UUID, -- Optional, can link to public.profiles.id or auth.users.id
    lead_id UUID,
    entity_id UUID,
    input JSONB,
    output JSONB,
    model_used TEXT,
    latency INT,
    token_counts JSONB,
    cost_estimates JSONB,
    status TEXT,
    errors JSONB,
    feedback_scores JSONB,
    comments TEXT,
    CONSTRAINT fk_agent_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_agent_logs_trace_id ON public.agent_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON public.agent_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_logs_tenant_id ON public.agent_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user_id ON public.agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_status ON public.agent_logs(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency during development)
DROP POLICY IF EXISTS "Allow tenant access to agent_logs" ON public.agent_logs;
DROP POLICY IF EXISTS "Allow support_agent to view all agent_logs" ON public.agent_logs;

-- RLS Policy: Restrict access based on tenant_id for authenticated users
CREATE POLICY "Allow tenant access to agent_logs" ON public.agent_logs
FOR SELECT USING (
    auth.uid() IS NOT NULL AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- RLS Policy: Allow 'support_agent' role to view across tenants (under strict audit)
CREATE POLICY "Allow support_agent to view all agent_logs" ON public.agent_logs
FOR SELECT TO "support_agent" USING (
    true -- Support agents can view all logs, subject to external audit controls
);

-- Comments for clarity
COMMENT ON TABLE public.agent_logs IS 'Stores detailed logs of agent interactions, including inputs, outputs, and performance metrics.';
COMMENT ON COLUMN public.agent_logs.trace_id IS 'Unique identifier for a specific agent interaction trace.';
COMMENT ON COLUMN public.agent_logs.timestamp IS 'Timestamp of the log entry in UTC.';
COMMENT ON COLUMN public.agent_logs.tenant_id IS 'Identifier of the tenant associated with the agent interaction.';
COMMENT ON COLUMN public.agent_logs.user_id IS 'Optional: Identifier of the user who initiated the agent interaction.';
COMMENT ON COLUMN public.agent_logs.lead_id IS 'Optional: Identifier of the lead entity involved in the interaction.';
COMMENT ON COLUMN public.agent_logs.entity_id IS 'Optional: Identifier of the primary entity involved in the interaction.';
COMMENT ON COLUMN public.agent_logs.input IS 'JSONB: Agent input, potentially summarized or redacted for privacy.';
COMMENT ON COLUMN public.agent_logs.output IS 'JSONB: Agent output, potentially summarized or redacted for privacy.';
COMMENT ON COLUMN public.agent_logs.model_used IS 'Name or identifier of the AI model used for the interaction.';
COMMENT ON COLUMN public.agent_logs.latency IS 'Latency of the agent interaction in milliseconds.';
COMMENT ON COLUMN public.agent_logs.token_counts IS 'JSONB: Details on token usage (e.g., prompt, completion, total).';
COMMENT ON COLUMN public.agent_logs.cost_estimates IS 'JSONB: Estimated cost of the interaction.';
COMMENT ON COLUMN public.agent_logs.status IS 'Status of the agent interaction (e.g., success, failure).';
COMMENT ON COLUMN public.agent_logs.errors IS 'JSONB: Details of any errors encountered during the interaction.';
COMMENT ON COLUMN public.agent_logs.feedback_scores IS 'JSONB: Optional: User or system feedback scores for the interaction.';
COMMENT ON COLUMN public.agent_logs.comments IS 'Optional: Additional comments or notes about the interaction.';