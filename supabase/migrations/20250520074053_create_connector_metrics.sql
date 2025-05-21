-- Create connector_metrics table
CREATE TABLE IF NOT EXISTS public.connector_metrics (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID, -- Can be NULL if metric is not tenant-specific or for system-wide connectors
    connector_id UUID, -- FK to integration_connectors.id
    connector_name TEXT, -- Denormalized for easier querying, or join with integration_connectors
    service_name TEXT,   -- Denormalized from integration_connectors.service_name
    metric_type TEXT NOT NULL, -- e.g., 'api_call_latency_ms', 'error_count_total', 'data_throughput_bytes'
    value DOUBLE PRECISION NOT NULL,
    labels JSONB, -- For additional metric dimensions like endpoint, http_method, status_code
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add foreign key constraint to integration_connectors
-- Ensure integration_connectors table exists before running this.
-- It might be better to add this constraint in a separate migration if table creation order is an issue.
ALTER TABLE public.connector_metrics
ADD CONSTRAINT fk_metrics_connector FOREIGN KEY (connector_id) 
REFERENCES public.integration_connectors(id) ON DELETE SET NULL;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_connector_metrics_timestamp ON public.connector_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_connector_metrics_tenant_id ON public.connector_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_connector_metrics_connector_id ON public.connector_metrics(connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_metrics_metric_type ON public.connector_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_connector_metrics_service_name ON public.connector_metrics(service_name);


-- Comments for clarity
COMMENT ON TABLE public.connector_metrics IS 'Stores performance and operational metrics for integration connectors.';
COMMENT ON COLUMN public.connector_metrics.tenant_id IS 'Identifier of the tenant associated with this metric, if applicable.';
COMMENT ON COLUMN public.connector_metrics.connector_id IS 'Identifier of the specific connector instance this metric pertains to.';
COMMENT ON COLUMN public.connector_metrics.metric_type IS 'Type of the metric (e.g., latency_ms, error_count, throughput_rpm).';
COMMENT ON COLUMN public.connector_metrics.value IS 'The value of the metric.';
COMMENT ON COLUMN public.connector_metrics.labels IS 'Additional key-value pairs for categorizing and filtering metrics (e.g., endpoint, status_code).';
COMMENT ON COLUMN public.connector_metrics.timestamp IS 'Timestamp when the metric was recorded.';