import vaultClient from 'node-vault';
import config from 'config/index';
import logger from 'utils/logger';

let vault: ReturnType<typeof vaultClient> | null = null;

if (config.VAULT_ADDR && config.VAULT_TOKEN) {
  try {
    const options = {
      apiVersion: 'v1', // Default
      endpoint: config.VAULT_ADDR,
      token: config.VAULT_TOKEN,
      // namespace: process.env.VAULT_NAMESPACE, // Optional: if using Vault namespaces
      // requestOptions: { // Optional: for TLS, timeouts, etc.
      //   timeout: 5000, // ms
      //   // ca: fs.readFileSync('/path/to/ca.pem'), // Example for self-signed certs
      // }
    };
    vault = vaultClient(options);
    logger.info(`Vault client initialized for address: ${config.VAULT_ADDR}`);

    // Optional: Perform a health check or status check on initialization
    // vault.health().then((healthStatus) => {
    //   if (healthStatus.initialized && !healthStatus.sealed && !healthStatus.standby) {
    //     logger.info('Vault is healthy and unsealed.');
    //   } else {
    //     logger.warn({ healthStatus }, 'Vault is not in an optimal state.');
    //   }
    // }).catch(err => {
    //   logger.error({ err }, 'Failed to get Vault health status on init.');
    // });

  } catch (error) {
    logger.error({ error, vaultAddr: config.VAULT_ADDR }, 'Failed to initialize Vault client.');
    vault = null; // Ensure vault is null if initialization fails
  }
} else {
  logger.warn('VAULT_ADDR or VAULT_TOKEN not configured. Vault client will not be initialized. Secret retrieval will be disabled.');
}

/**
 * Retrieves a secret from HashiCorp Vault.
 * Assumes KV version 2 secrets engine.
 * @param path The full path to the secret (e.g., 'kv/data/tenant_xyz/connector_abc/api_key')
 * @param key The specific key within the secret's data to retrieve.
 * @returns The secret value, or null if not found or an error occurs.
 */
export async function getSecret<T = string>(path: string, key: string): Promise<T | null> {
  if (!vault) {
    logger.error({ path, key }, 'Vault client not initialized. Cannot retrieve secret.');
    // Potentially throw an error here if Vault is critical for all operations
    return null;
  }

  try {
    // For KV v2, the path usually includes 'data/' after the mount point, e.g., 'secret/data/my-secret'
    // The client library might handle this, or you might need to adjust the path.
    // The `node-vault` library's `read` method typically expects the path without `data/` for KV v2.
    // Example: if full path in Vault UI is `kv/data/foo`, path for `read` is `kv/foo`.
    // This needs to be consistent with how paths are stored in `auth_config.secret_key_vault_path`.
    // Let's assume `secret_key_vault_path` is the direct path for the `read` command.

    const response = await vault.read(path);
    if (response && response.data && response.data.data && response.data.data[key]) {
      logger.debug({ path, key }, 'Secret retrieved successfully from Vault.');
      return response.data.data[key] as T;
    } else {
      logger.warn({ path, key, responseData: response?.data }, 'Secret key not found at path or data structure unexpected.');
      return null;
    }
  } catch (error: any) {
    logger.error({ error: error.message, path, key, status: error.response?.statusCode }, 'Error retrieving secret from Vault.');
    return null;
  }
}

export default vault; // Export the initialized client instance (or null)