import { IntegrationConnector } from 'types/connector.types';

export interface AuthStrategyCredentials {
  // Common structure for credentials returned by a strategy
  // This might include tokens, headers, or other auth-related data
  [key: string]: any;
}

export interface IAuthStrategy {
  /**
   * The type of authentication this strategy handles (e.g., 'apikey', 'oauth2').
   */
  readonly type: string;

  /**
   * Prepares the necessary credentials or authentication headers/parameters.
   * This method might involve fetching secrets from a vault, refreshing tokens, etc.
   * @param connectorConfig The configuration for the specific connector instance.
   * @returns A promise that resolves to the authentication credentials or parameters.
   * @throws Error if authentication preparation fails (e.g., secret not found, token refresh failed).
   */
  prepareAuth(connectorConfig: IntegrationConnector): Promise<AuthStrategyCredentials>;

  /**
   * Optional: Handles any post-connection logic, such as storing new tokens.
   * @param connectorConfig The configuration for the specific connector instance.
   * @param authResult The result from an authentication attempt (e.g., new tokens from OAuth2).
   */
  handleAuthCallback?(connectorConfig: IntegrationConnector, authResult: any): Promise<void>;

  /**
   * Optional: Tests the validity of the current authentication configuration.
   * @param connectorConfig The configuration for the specific connector instance.
   * @returns A promise that resolves to true if auth is valid, false otherwise.
   */
  testAuth?(connectorConfig: IntegrationConnector): Promise<boolean>;
}