export interface IntegrationConnector {
  id: string; // UUID
  tenant_id: string; // UUID
  connector_name: string;
  service_name: string;
  auth_type: 'oauth2' | 'apikey' | 'basic' | 'custom';
  auth_config: Record<string, any>; // JSONB
  api_spec?: Record<string, any>; // JSONB, Optional
  scopes?: string[]; // TEXT[], Optional
  is_active: boolean;
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ
  last_connected_at?: string; // TIMESTAMPTZ, Optional
  last_error?: Record<string, any>; // JSONB, Optional
  metadata?: Record<string, any>; // JSONB, Optional
  sync_version?: Uint8Array; // BYTEA, Optional - Yjs state vector or update
  last_sync_at?: string; // TIMESTAMPTZ, Optional
}

export type CreateIntegrationConnectorDTO = Omit<IntegrationConnector, 'id' | 'created_at' | 'updated_at' | 'is_active' | 'last_connected_at' | 'last_error'> & {
  is_active?: boolean;
};

export type UpdateIntegrationConnectorDTO = Partial<Omit<IntegrationConnector, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>;

// For query parameters when listing connectors
export interface ListConnectorsQuery {
  tenant_id: string;
  service_name?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}