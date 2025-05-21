import { IntegrationConnector, CreateIntegrationConnectorDTO, UpdateIntegrationConnectorDTO } from './connector.types';

// ======== General API Structures ========

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
  };
}

// ======== Connector Configurations API (/configurations) ========

// POST /configurations
export type CreateConnectorConfigRequest = CreateIntegrationConnectorDTO;
export type CreateConnectorConfigResponse = IntegrationConnector;

// GET /configurations
export interface ListConnectorConfigsQuery {
  tenant_id: string; // Usually from authenticated context, but explicit for clarity
  service_name?: string;
  is_active?: boolean;
  limit?: number; // For pagination
  offset?: number; // For pagination
}
export interface ListConnectorConfigsResponseItem {
  id: string;
  connector_name: string;
  service_name: string;
  auth_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export type ListConnectorConfigsPaginatedResponse = PaginatedResponse<ListConnectorConfigsResponseItem>;

// GET /configurations/{connectorId}
export type GetConnectorConfigResponse = IntegrationConnector;

// PUT /configurations/{connectorId}
export type UpdateConnectorConfigRequest = UpdateIntegrationConnectorDTO;
export type UpdateConnectorConfigResponse = IntegrationConnector;

// DELETE /configurations/{connectorId} - No specific response body for 204

// ======== Connector Operations API (/connectors) ========

// POST /connectors/{connectorId}/test-connection
export interface TestConnectionResponse {
  status: 'success' | 'failure';
  message?: string;
  tested_at: string; // ISO timestamp
}

// GET /connectors/{connectorId}/data
export interface FetchDataQuery {
  resource_path: string;
  [key: string]: any; // Allow other dynamic query params
}
export interface FetchDataResponse<T = any> {
  data: T;
  source_metadata?: {
    request_url?: string;
    status_code?: number;
    // other relevant metadata from the source API response
  };
}

// POST /connectors/{connectorId}/actions
export interface PerformActionRequest<P = any> {
  action_name: string;
  payload?: P;
  resource_path?: string; // Some actions might target a resource path
  method?: 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'GET'; // Action might imply a method
}
export interface PerformActionResponse<R = any> {
  status: 'success' | 'failure';
  message?: string;
  result?: R;
}

// ======== Health Check API (/health) ========
export interface HealthCheckResponse {
    status: 'ok' | 'error';
    timestamp: string;
    message?: string;
    dependencies?: Array<{ name: string; status: 'ok' | 'error'; message?: string }>;
}