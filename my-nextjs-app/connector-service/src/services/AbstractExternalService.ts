import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { connectorManager, ConnectorManager } from 'core/ConnectorManager';
import { IntegrationConnector } from 'types/connector.types';
import logger from 'utils/logger';

export interface ExternalServiceRequestOptions {
  resourcePath: string; // e.g., "/users", "/files/fileId"
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  payload?: any;
  queryParams?: Record<string, any>;
  additionalHeaders?: Record<string, string>;
  timeout?: number; // Optional request timeout in milliseconds
}

export abstract class AbstractExternalService {
  protected serviceName: string;
  protected manager: ConnectorManager;

  constructor(serviceName: string, managerInstance: ConnectorManager = connectorManager) {
    this.serviceName = serviceName;
    this.manager = managerInstance;
  }

  /**
   * A unique identifier for the type of service this handler interacts with.
   * (e.g., 'google-drive', 'slack', 'jira')
   */
  abstract getServiceName(): string;

  /**
   * Fetches data from the external service.
   * @param connector The specific connector configuration to use.
   * @param options Options for the data request, like resource path and query params.
   */
  async fetchData<T = any>(
    connector: IntegrationConnector,
    options: ExternalServiceRequestOptions
  ): Promise<AxiosResponse<T>> {
    if (connector.service_name !== this.getServiceName()) {
      logger.error(
        { expected: this.getServiceName(), actual: connector.service_name, connectorId: connector.id },
        'Mismatched service handler for connector'
      );
      throw new Error(`Mismatched service handler. Expected ${this.getServiceName()}, got ${connector.service_name}.`);
    }

    const requestConfig: AxiosRequestConfig = {
      method: options.method || 'GET',
      url: options.resourcePath, // This will be relative to any baseURL provided by auth strategy or connector.api_spec
      data: options.payload,
      params: options.queryParams,
      headers: options.additionalHeaders,
    };
    
    // If api_spec contains a base URL, it should be prioritized or combined.
    // For now, assuming baseURL might come from auth strategy or be fully qualified in resourcePath.
    if (connector.api_spec?.servers?.[0]?.url && !requestConfig.baseURL) {
        // A more robust solution would be to select the appropriate server based on environment/tags
        requestConfig.baseURL = connector.api_spec.servers[0].url;
    }


    logger.info(
      { connectorId: connector.id, service: this.serviceName, path: options.resourcePath },
      `Fetching data via ${this.serviceName} handler.`
    );
    return this.manager.makeRequest<T>(connector.id, connector.tenant_id, requestConfig);
  }

  /**
   * Performs an action on the external service.
   * @param connector The specific connector configuration to use.
   * @param options Options for the action, like action name and payload.
   */
  async performAction<T = any>(
    connector: IntegrationConnector,
    options: ExternalServiceRequestOptions
  ): Promise<AxiosResponse<T>> {
     if (connector.service_name !== this.getServiceName()) {
      logger.error(
        { expected: this.getServiceName(), actual: connector.service_name, connectorId: connector.id },
        'Mismatched service handler for connector action'
      );
      throw new Error(`Mismatched service handler for action. Expected ${this.getServiceName()}, got ${connector.service_name}.`);
    }

    const requestConfig: AxiosRequestConfig = {
      method: options.method || 'POST', // Default to POST for actions
      url: options.resourcePath,
      data: options.payload,
      params: options.queryParams,
      headers: options.additionalHeaders,
    };
    
    if (connector.api_spec?.servers?.[0]?.url && !requestConfig.baseURL) {
        requestConfig.baseURL = connector.api_spec.servers[0].url;
    }

    logger.info(
      { connectorId: connector.id, service: this.serviceName, action: options.resourcePath, method: requestConfig.method },
      `Performing action via ${this.serviceName} handler.`
    );
    return this.manager.makeRequest<T>(connector.id, connector.tenant_id, requestConfig);
  }

  /**
   * Tests the connection to the external service using the provided connector configuration.
   * This often involves making a simple, authenticated GET request to a known endpoint.
   * @param connector The connector configuration to test.
   * @returns True if the connection is successful, false otherwise.
   */
  abstract testConnection(connector: IntegrationConnector): Promise<boolean>;
}
