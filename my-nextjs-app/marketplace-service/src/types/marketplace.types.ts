/**
 * Represents a connector as listed in the marketplace.
 * This should align with the `marketplace_connectors` Supabase table.
 */
export interface MarketplaceConnectorEntry {
  id: string; // UUID
  name: string;
  description?: string;
  service_identifier: string; // e.g., 'google-drive', 'slack'
  logo_url?: string;
  category?: string;
  vendor?: string;
  default_auth_config?: Record<string, any>; // JSONB
  default_api_spec?: Record<string, any>;   // JSONB
  available_scopes?: string[];
  setup_guide_url?: string;
  is_featured?: boolean;
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ
  is_installed_for_tenant?: boolean; // Added to indicate if tenant has this service_identifier installed
}

/**
 * Data Transfer Object for listing marketplace connectors.
 * Could include pagination, filtering, sorting parameters.
 */
export interface ListMarketplaceConnectorsDTO {
  tenant_id: string; // To potentially personalize listings or check existing installations
  category?: string;
  search_term?: string;
  is_featured?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: 'name' | 'created_at' | 'popularity'; // Example sort fields
  sort_order?: 'asc' | 'desc';
}

/**
 * Data Transfer Object for installing a connector from the marketplace.
 * This would trigger the creation of an `integration_connectors` entry.
 */
export interface InstallMarketplaceConnectorDTO {
  tenant_id: string;
  marketplace_connector_id: string; // The ID from marketplace_connectors table
  // Optional: User-provided overrides for default_auth_config or other initial settings
  custom_auth_config?: Record<string, any>;
  custom_name?: string; // Allow user to name their specific instance
}

/**
 * Represents the result of an installation attempt.
 */
export interface InstallationResult {
  success: boolean;
  message: string;
  installed_connector_id?: string; // ID of the newly created integration_connectors record
  error_details?: any;
}

// Add other marketplace-specific types here as the service evolves.