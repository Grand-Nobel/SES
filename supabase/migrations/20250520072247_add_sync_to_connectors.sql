-- Add sync_version and last_sync_at to integration_connectors table
ALTER TABLE public.integration_connectors
ADD COLUMN IF NOT EXISTS sync_version BYTEA,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- Optional: Consider adding an index if last_sync_at will be frequently queried
-- CREATE INDEX IF NOT EXISTS idx_integration_connectors_last_sync_at ON public.integration_connectors(last_sync_at);

COMMENT ON COLUMN public.integration_connectors.sync_version IS 'Stores the Yjs state vector or update, representing the version of the synced data for this connector.';
COMMENT ON COLUMN public.integration_connectors.last_sync_at IS 'Timestamp of the last successful synchronization for this connector.';