import { IAuthStrategy, AuthStrategyCredentials } from './IAuthStrategy';
import { IntegrationConnector } from 'types/connector.types';
import logger from 'utils/logger';
import { getSecret } from 'config/vault'; // Import the getSecret function

// Define a more specific type for API key auth_config
interface ApiKeyAuthConfig {
  api_key_name: string; // Name of the header or query param
  key_location: 'header' | 'query';
  secret_key_vault_path: string; // Path to the secret in Vault
  secret_key_name_in_vault: string; // The key name within the Vault secret's data
  // secret_key_value?: string; // Fallback or for non-Vault scenarios, if needed
}

export class ApiKeyStrategy implements IAuthStrategy {
  public readonly type = 'apikey';

  async prepareAuth(connectorConfig: IntegrationConnector): Promise<AuthStrategyCredentials> {
    const authConfig = connectorConfig.auth_config as ApiKeyAuthConfig;

    if (!authConfig.api_key_name || !authConfig.key_location) {
      logger.error({ connectorId: connectorConfig.id, authConfig }, 'API key name or location is missing in auth_config.');
      throw new Error('API key name or location is missing for APIKeyStrategy.');
    }

    if (!authConfig.secret_key_vault_path || !authConfig.secret_key_name_in_vault) {
      logger.error(
        { connectorId: connectorConfig.id, authConfig },
        'Vault path or secret key name is missing in auth_config for APIKeyStrategy.'
      );
      throw new Error('Vault path or secret key name is missing for APIKeyStrategy.');
    }

    const apiKey = await getSecret<string>(authConfig.secret_key_vault_path, authConfig.secret_key_name_in_vault);

    if (!apiKey) {
      logger.error(
        { connectorId: connectorConfig.id, vaultPath: authConfig.secret_key_vault_path, keyName: authConfig.secret_key_name_in_vault },
        'Failed to retrieve API key from Vault or key is empty.'
      );
      throw new Error('Failed to retrieve API key from Vault.');
    }

    const credentials: AuthStrategyCredentials = {};

    if (authConfig.key_location === 'header') {
      credentials.headers = {
        [authConfig.api_key_name]: apiKey,
      };
    } else if (authConfig.key_location === 'query') {
      credentials.params = {
        [authConfig.api_key_name]: apiKey,
      };
    } else {
      logger.error({ connectorId: connectorConfig.id, location: authConfig.key_location }, 'Invalid API key location specified.');
      throw new Error(`Invalid API key location: ${authConfig.key_location}`);
    }

    logger.debug({ connectorId: connectorConfig.id, type: this.type }, 'API key auth prepared.');
    return credentials;
  }

  async testAuth(connectorConfig: IntegrationConnector): Promise<boolean> {
    // For API keys, a simple test is often to try and make a basic, authenticated request.
    // This would typically be implemented in the specific service handler (e.g., GoogleDriveService.ts)
    // by calling a lightweight endpoint of the external service.
    // For now, we'll assume if prepareAuth doesn't throw, the config is "testable".
    // A more robust test would involve an actual API call.
    try {
      await this.prepareAuth(connectorConfig);
      logger.info({ connectorId: connectorConfig.id, type: this.type }, 'API key auth test (prepareAuth) successful.');
      return true;
    } catch (error) {
      logger.error({ connectorId: connectorConfig.id, type: this.type, error }, 'API key auth test (prepareAuth) failed.');
      return false;
    }
  }
}