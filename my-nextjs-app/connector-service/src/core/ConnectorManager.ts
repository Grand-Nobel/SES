import { connectorRepository, ConnectorRepository } from 'db/repositories/ConnectorRepository';
import { IntegrationConnector } from 'types/connector.types';
import { IAuthStrategy, AuthStrategyCredentials } from 'core/auth/IAuthStrategy';
import { ApiKeyStrategy } from 'core/auth/ApiKeyStrategy';
// Import other strategies like OAuth2Strategy when they are created
import { SyncFramework } from '../core/sync/SyncFramework'; // Added for Bi-Directional Sync
import logger from 'utils/logger';
import axios, { AxiosRequestConfig, AxiosInstance, AxiosResponse } from 'axios';

export class ConnectorManager {
  private strategies: Map<string, IAuthStrategy>;
  private httpClient: AxiosInstance;

  constructor(private repo: ConnectorRepository = connectorRepository) {
    this.strategies = new Map();
    this.registerStrategy(new ApiKeyStrategy());
    // Register other strategies here
    // this.registerStrategy(new OAuth2Strategy());

    this.httpClient = axios.create({
      timeout: 15000, // Default timeout for HTTP requests
    });
  }

  private registerStrategy(strategy: IAuthStrategy): void {
    this.strategies.set(strategy.type, strategy);
    logger.info(`Auth strategy registered: ${strategy.type}`);
  }

  private async getConnectorConfig(connectorId: string, tenantId: string): Promise<IntegrationConnector> {
    const connector = await this.repo.findById(connectorId, tenantId);
    if (!connector) {
      logger.error({ connectorId, tenantId }, 'Connector configuration not found.');
      throw new Error(`Connector configuration not found for ID: ${connectorId} and tenant: ${tenantId}`);
    }
    if (!connector.is_active) {
      logger.warn({ connectorId, tenantId }, 'Attempted to use an inactive connector.');
      throw new Error(`Connector ID: ${connectorId} is not active.`);
    }
    return connector;
  }

  private getStrategy(authType: string): IAuthStrategy {
    const strategy = this.strategies.get(authType);
    if (!strategy) {
      logger.error({ authType }, 'Unsupported authentication type or strategy not registered.');
      throw new Error(`Unsupported authentication type: ${authType}`);
    }
    return strategy;
  }

  async prepareAuthenticatedRequest(
    connectorId: string,
    tenantId: string,
    requestConfig: Partial<AxiosRequestConfig> = {}
  ): Promise<AxiosRequestConfig> {
    const connector = await this.getConnectorConfig(connectorId, tenantId);
    const strategy = this.getStrategy(connector.auth_type);

    logger.debug({ connectorId, tenantId, authType: connector.auth_type }, 'Preparing authenticated request.');
    const authCredentials = await strategy.prepareAuth(connector);

    const finalConfig: AxiosRequestConfig = {
      ...requestConfig,
      headers: {
        ...requestConfig.headers,
        ...(authCredentials.headers || {}),
      },
      params: {
        ...requestConfig.params,
        ...(authCredentials.params || {}),
      },
      // Other auth-specific properties from AuthStrategyCredentials can be merged here
    };
    
    // If the auth strategy provided a base URL (e.g. from OAuth2 resource server URI)
    if (authCredentials.baseURL && !finalConfig.baseURL) {
        finalConfig.baseURL = authCredentials.baseURL;
    }

    logger.info({ connectorId, tenantId }, 'Authenticated request prepared.');
    return finalConfig;
  }

  async testConnector(connectorId: string, tenantId: string): Promise<{ status: 'success' | 'failure'; message?: string; tested_at: string }> {
    const tested_at = new Date().toISOString();
    try {
      const connector = await this.getConnectorConfig(connectorId, tenantId);
      const strategy = this.getStrategy(connector.auth_type);

      if (strategy.testAuth) {
        const isAuthValid = await strategy.testAuth(connector);
        if (isAuthValid) {
          logger.info({ connectorId, tenantId }, 'Connector test successful.');
          await this.repo.update(connectorId, tenantId, { last_connected_at: tested_at, last_error: undefined });
          return { status: 'success', message: 'Connection test successful.', tested_at };
        } else {
          logger.warn({ connectorId, tenantId }, 'Connector test failed: Authentication strategy testAuth returned false.');
          await this.repo.update(connectorId, tenantId, { last_error: { message: 'Authentication strategy testAuth failed.' } });
          return { status: 'failure', message: 'Connection test failed: Authentication strategy reported an issue.', tested_at };
        }
      } else {
        logger.info({ connectorId, tenantId }, 'Connector test skipped: No testAuth method for strategy.');
         await this.repo.update(connectorId, tenantId, { last_connected_at: tested_at, last_error: undefined }); // Assume success if no test method
        return { status: 'success', message: 'Connection test considered successful (no specific test method for auth type).', tested_at };
      }
    } catch (error: any) {
      logger.error({ connectorId, tenantId, error: error.message }, 'Connector test failed with exception.');
      // Avoid overwriting last_error if findById failed before update attempt
      try {
        await this.repo.update(connectorId, tenantId, { last_error: { message: error.message, stack: error.stack } });
      } catch (updateError) {
        logger.error({ connectorId, tenantId, updateError }, 'Failed to update connector last_error after test failure.');
      }
      return { status: 'failure', message: `Connection test failed: ${error.message}`, tested_at };
    }
  }

  async makeRequest<T = any>(
    connectorId: string,
    tenantId: string,
    requestConfig: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    const authenticatedConfig = await this.prepareAuthenticatedRequest(connectorId, tenantId, requestConfig);
    
    logger.info({ connectorId, tenantId, url: authenticatedConfig.url, method: authenticatedConfig.method }, 'Making authenticated request.');
    try {
      const response = await this.httpClient.request<T>(authenticatedConfig);
      // Update last_connected_at on successful request
      try {
        await this.repo.update(connectorId, tenantId, { last_connected_at: new Date().toISOString(), last_error: undefined });
      } catch(updateError) {
         logger.warn({connectorId, tenantId, updateError}, "Failed to update last_connected_at after successful request");
      }
      return response;
    } catch (error: any) {
      logger.error({
        connectorId,
        tenantId,
        url: authenticatedConfig.url,
        method: authenticatedConfig.method,
        error: error.isAxiosError ? error.toJSON() : error.message,
      }, 'Authenticated request failed.');
      // Update last_error on failed request
       try {
        await this.repo.update(connectorId, tenantId, { last_error: { 
            message: error.message, 
            details: error.isAxiosError ? error.toJSON() : error.stack 
        }});
      } catch(updateError) {
         logger.warn({connectorId, tenantId, updateError}, "Failed to update last_error after failed request");
      }
      throw error; // Re-throw to be handled by API layer
    }
  }

  async synchronizeConnectorData(connectorId: string, tenantId: string): Promise<{ success: boolean; message?: string; newSyncVersion?: Uint8Array, lastSyncAt?: string }> {
    logger.info({ connectorId, tenantId }, 'Attempting to synchronize connector data.');
    try {
      const connector = await this.getConnectorConfig(connectorId, tenantId);
      if (!connector) {
        // getConnectorConfig throws, but as a safeguard:
        logger.error({ connectorId, tenantId }, 'Connector not found for synchronization.');
        return { success: false, message: 'Connector not found.' };
      }

      // Initialize SyncFramework with the connector's current sync version
      const syncFramework = new SyncFramework(connector.sync_version || undefined);

      // Call the syncData method (currently a placeholder in SyncFramework)
      // This would involve fetching remote data, applying local changes, etc.
      // For now, it will return a new state based on its internal Yjs doc.
      const syncResult = await syncFramework.syncData(/* parameters for actual sync operation */);

      if (syncResult.success && syncResult.newState) {
        const lastSyncAt = new Date().toISOString();
        await this.repo.update(connectorId, tenantId, {
          sync_version: syncResult.newState,
          last_sync_at: lastSyncAt,
          last_error: undefined, // Clear any previous sync errors
        });
        logger.info({ connectorId, tenantId }, 'Connector data synchronized successfully.');
        return {
          success: true,
          message: 'Data synchronized successfully.',
          newSyncVersion: syncResult.newState,
          lastSyncAt: lastSyncAt
        };
      } else {
        logger.error({ connectorId, tenantId, error: syncResult.error }, 'Data synchronization failed.');
        await this.repo.update(connectorId, tenantId, {
          last_error: { message: `Sync failed: ${syncResult.error}`, source: 'SyncFramework.syncData' }
        });
        return { success: false, message: `Data synchronization failed: ${syncResult.error}` };
      }
    } catch (error: any) {
      logger.error({ connectorId, tenantId, error: error.message }, 'Exception during synchronizeConnectorData.');
      // Attempt to update last_error on the connector if an exception occurs
      try {
        await this.repo.update(connectorId, tenantId, {
            last_error: { message: `Sync exception: ${error.message}`, stack: error.stack, source: 'ConnectorManager.synchronizeConnectorData' }
        });
      } catch (updateError) {
        logger.error({ connectorId, tenantId, updateError }, 'Failed to update connector last_error after sync exception.');
      }
      return { success: false, message: `Exception during data synchronization: ${error.message}` };
    }
  }
}

export const connectorManager = new ConnectorManager();