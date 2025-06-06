-- Create system_logs table
CREATE TABLE IF NOT EXISTS public.system_logs (
    id BIGSERIAL PRIMARY KEY,
    trace_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID, -- Optional, for tenant-specific system events
    event_type TEXT NOT NULL,
    service_name TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    severity TEXT,
    CONSTRAINT fk_system_logs_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL
);

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_system_logs_trace_id ON public.system_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON public.system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_tenant_id ON public.system_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON public.system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_service_name ON public.system_logs(service_name);
CREATE INDEX IF NOT EXISTS idx_system_logs_severity ON public.system_logs(severity);

-- Enable Row Level Security (RLS)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency during development)
DROP POLICY IF EXISTS "Allow system-level and tenant-specific system_logs access" ON public.system_logs;
DROP POLICY IF EXISTS "Allow support_agent to view all system_logs" ON public.system_logs;

-- RLS Policy: Allow viewing system-level logs (tenant_id IS NULL) or tenant-specific logs
CREATE POLICY "Allow system-level and tenant-specific system_logs access" ON public.system_logs
FOR SELECT USING (
    tenant_id IS NULL OR (auth.uid() IS NOT NULL AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
);

-- RLS Policy: Allow 'support_agent' role to view across tenants
CREATE POLICY "Allow support_agent to view all system_logs" ON public.system_logs
FOR SELECT TO "support_agent" USING (
    true -- Support agents can view all logs, subject to external audit controls
);

-- Comments for clarity
COMMENT ON TABLE public.system_logs IS 'Stores system-level events and operational logs for monitoring and debugging.';
COMMENT ON COLUMN public.system_logs.trace_id IS 'Unique identifier for a specific system event trace.';
COMMENT ON COLUMN public.system_logs.timestamp IS 'Timestamp of the log entry in UTC.';
COMMENT ON COLUMN public.system_logs.tenant_id IS 'Optional: Identifier of the tenant if the event is tenant-specific.';
COMMENT ON COLUMN public.system_logs.event_type IS 'Type of system event (e.g., DATABASE_ERROR, SERVICE_START, API_CALL).';
COMMENT ON COLUMN public.system_logs.service_name IS 'Name of the service or component that generated the log.';
COMMENT ON COLUMN public.system_logs.message IS 'Detailed log message.';
COMMENT ON COLUMN public.system_logs.metadata IS 'JSONB: Additional structured data related to the event.';
COMMENT ON COLUMN public.system_logs.severity IS 'Severity level of the log (e.g., INFO, WARN, ERROR, CRITICAL).';