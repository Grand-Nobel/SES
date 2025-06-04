import { AbstractExternalService, ExternalServiceRequestOptions } from './AbstractExternalService';
import { IntegrationConnector } from '../types/connector.types';
import axios, { AxiosResponse } from 'axios';

export class OracleERPService extends AbstractExternalService {
  constructor(connectorConfig: IntegrationConnector) {
    super('oracle-erp'); // Pass service name to the base class constructor
    this.connectorConfig = connectorConfig; // Store connectorConfig if needed in other methods
  }

  private connectorConfig: IntegrationConnector; // Store connector config

  getServiceName(): string {
    return 'oracle-erp';
  }

  async authenticate(): Promise<boolean> {
    console.log(`Authenticating with Oracle ERP for connector: ${this.connectorConfig.id}, type: ${this.connectorConfig.erp_type}`);

    if (this.connectorConfig.erp_type === 'fusion') {
      console.log('Attempting Oracle Fusion Cloud ERP authentication...');
      if (this.connectorConfig.auth_type?.toLowerCase() !== 'oauth2') {
        console.error('Oracle Fusion Cloud ERP requires OAuth 2.0 authentication.');
        return false;
      }
      if (!this.connectorConfig.auth_config || !this.connectorConfig.auth_config.token_url || !this.connectorConfig.auth_config.client_id || !this.connectorConfig.auth_config.client_secret) {
        console.error('Missing OAuth 2.0 configuration for Fusion ERP (token_url, client_id, client_secret).');
        return false;
      }

      const { token_url, client_id, client_secret, scope } = this.connectorConfig.auth_config;

      try {
        const response = await axios.post(token_url, new URLSearchParams({
          grant_type: 'client_credentials', // Common for server-to-server
          client_id: client_id,
          client_secret: client_secret,
          scope: scope || 'urn:opc:resource:consumer::all' // Default scope, adjust as needed
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (response.data && response.data.access_token) {
          this.connectorConfig.authDetails = {
            accessToken: response.data.access_token,
            expiresIn: response.data.expires_in,
            tokenType: response.data.token_type,
            // refreshToken: response.data.refresh_token, // If applicable
          };
          console.log('Successfully authenticated with Oracle Fusion Cloud ERP.');
          return true;
        } else {
          console.error('Failed to retrieve access token from Oracle Fusion Cloud ERP.', response.data);
          return false;
        }
      } catch (error: any) {
        console.error('Error during Oracle Fusion Cloud ERP authentication:', error.response?.data || error.message);
        return false;
      }
    } else if (this.connectorConfig.erp_type === 'netsuite') {
      console.log('Verifying Oracle NetSuite TBA configuration...');
      const { consumer_key, consumer_secret, token_id, token_secret, account_id } = this.connectorConfig.auth_config || {};
      if (!consumer_key || !consumer_secret || !token_id || !token_secret || !account_id) {
        console.error('Missing Token-Based Authentication (TBA) configuration for NetSuite (consumer_key, consumer_secret, token_id, token_secret, account_id).');
        return false;
      }
      // For TBA, authentication is per-request. This method primarily verifies config.
      console.log('Oracle NetSuite TBA configuration appears complete.');
      this.connectorConfig.authDetails = { // Store for easy access, though not a session token
        consumerKey: consumer_key,
        consumerSecret: consumer_secret,
        tokenId: token_id,
        tokenSecret: token_secret,
        accountId: account_id,
      };
      return true;
    }

    console.warn(`Unsupported erp_type: ${this.connectorConfig.erp_type} or auth_type: ${this.connectorConfig.auth_type}`);
    return false;
  }

  async fetchData<T = any>(connector: IntegrationConnector, options: ExternalServiceRequestOptions): Promise<AxiosResponse<T, any>> {
    console.log(`Fetching data from Oracle ERP for connector ${connector.id}, type: ${connector.erp_type}. Resource: ${options.resourcePath}`);
    console.log('Request Options:', options);

    if (connector.erp_type === 'fusion') {
      if (!connector.auth_config?.base_url) {
        console.error('Missing base_url in auth_config for Oracle Fusion Cloud ERP.');
        throw new Error('Missing base_url for Oracle Fusion Cloud ERP.');
      }
      if (!connector.authDetails?.accessToken) {
        console.error('Not authenticated. Missing accessToken for Oracle Fusion Cloud ERP.');
        throw new Error('Authentication required for Oracle Fusion Cloud ERP.');
      }

      const requestUrl = `${connector.auth_config.base_url}/${options.resourcePath}`;
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${connector.authDetails.accessToken}`,
        'Content-Type': options.payload ? 'application/json' : (options.method === 'GET' ? 'application/json' : 'application/vnd.oracle.adf.resourceitem+json'),
      };
      if (options.additionalHeaders) {
        Object.assign(headers, options.additionalHeaders);
      }
      
      console.log(`Fusion Request: ${options.method || 'GET'} ${requestUrl}`);
      try {
        const response = await axios.request<T>({
          method: options.method || 'GET',
          url: requestUrl,
          headers,
          params: options.queryParams,
          data: options.payload,
          timeout: options.timeout || 30000,
        });
        return response;
      } catch (error: any) {
        console.error(`Error fetching data from Oracle Fusion Cloud ERP for resource ${options.resourcePath}:`, error.response?.data || error.message);
        if (axios.isAxiosError(error) && error.response) {
          return error.response as AxiosResponse<T, any>;
        }
        throw error;
      }
    } else if (connector.erp_type === 'netsuite') {
      const { account_id, consumer_key, token_id } = connector.auth_config || {};
      if (!account_id || !consumer_key || !token_id || !connector.authDetails?.consumerSecret || !connector.authDetails?.tokenSecret ) {
        // Validating against authDetails as well, assuming authenticate() populated it
        console.error('Missing NetSuite TBA credentials in auth_config or authDetails.');
        throw new Error('NetSuite TBA credentials missing or not processed by authenticate().');
      }

      const realm = String(account_id).replace(/-/g, '_');
      const baseUrl = connector.auth_config.base_url || `https://${realm}.suitetalk.api.netsuite.com/services/rest`;
      const requestUrl = `${baseUrl}/${options.resourcePath}`;
      
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = Math.random().toString(36).substring(2);
      
      // IMPORTANT: oauth_signature generation requires a proper crypto library.
      // This is a placeholder for the signature value.
      const oauthSignature = "PLACEHOLDER_ACTUAL_SIGNATURE_REQUIRED"; 
      console.warn('NetSuite oauth_signature is a placeholder and needs actual implementation using a crypto library (e.g., crypto-js or Node crypto module).');

      const oauthHeader = `OAuth realm="${realm}", ` +
                          `oauth_consumer_key="${consumer_key}", ` +
                          `oauth_token="${token_id}", ` +
                          `oauth_signature_method="HMAC-SHA256", ` +
                          `oauth_timestamp="${timestamp}", ` +
                          `oauth_nonce="${nonce}", ` +
                          `oauth_version="1.0", ` +
                          `oauth_signature="${oauthSignature}"`;

      const headers: Record<string, string> = {
        'Authorization': oauthHeader,
        'Content-Type': options.payload ? 'application/json' : 'application/json',
      };
       if (options.additionalHeaders) {
        Object.assign(headers, options.additionalHeaders);
      }

      console.log(`NetSuite Request: ${options.method || 'GET'} ${requestUrl}`);
      try {
        const response = await axios.request<T>({
          method: options.method || 'GET',
          url: requestUrl,
          headers,
          params: options.queryParams,
          data: options.payload,
          timeout: options.timeout || 60000,
        });
        return response;
      } catch (error: any) {
        console.error(`Error fetching data from Oracle NetSuite for resource ${options.resourcePath}:`, error.response?.data || error.message);
         if (axios.isAxiosError(error) && error.response) {
          return error.response as AxiosResponse<T, any>;
        }
        throw error;
      }
    } else {
      console.error(`Unsupported erp_type for fetchData: ${connector.erp_type}`);
      throw new Error(`Unsupported erp_type for fetchData: ${connector.erp_type}`);
    }
  }

  async testConnection(connector: IntegrationConnector): Promise<boolean> {
    console.log('Testing connection to Oracle ERP for connector', connector.id, 'type:', connector.erp_type);

    if (connector.erp_type === 'fusion') {
      console.log('Testing connection to Oracle Fusion Cloud ERP...');
      if (!connector.auth_config?.base_url) {
        console.error('Missing base_url in auth_config for Fusion ERP connection test.');
        return false;
      }
      if (!connector.authDetails?.accessToken) {
        console.warn('Access token not found for Fusion ERP testConnection. Attempting to authenticate first.');
        // Assuming this.connectorConfig refers to the same logical connector instance as 'connector'
        // or that 'connector' would be updated by this call if it's the same object.
        const authSuccessful = await this.authenticate(); // Uses this.connectorConfig
        if (!authSuccessful || !this.connectorConfig.authDetails?.accessToken) { // Check this.connectorConfig after auth
            console.error('Authentication failed or access token still missing after re-attempt for Fusion ERP testConnection.');
            return false;
        }
        // If 'connector' is a different object than 'this.connectorConfig', its authDetails might be stale.
        // For this test, we'll proceed assuming the token is now available via the 'connector' reference,
        // or that 'fetchData' will correctly use the fresh token if 'connector' is 'this.connectorConfig'.
        // This implies 'connector' should have its 'authDetails' updated if it's not 'this.connectorConfig'.
        // For simplicity, we rely on 'connector.authDetails' being up-to-date for the fetchData call.
        // If 'this.authenticate()' updated 'this.connectorConfig', and 'connector' is a copy, this could be an issue.
        // Let's ensure 'connector.authDetails' is updated if 'this.connectorConfig' was.
        if (this.connectorConfig === connector && this.connectorConfig.authDetails) {
             connector.authDetails = this.connectorConfig.authDetails;
        } else if (!connector.authDetails && this.connectorConfig.authDetails?.accessToken) {
            // If connector didn't have authDetails but this.connectorConfig (which was authenticated) does, try to use it.
            // This is a fallback, ideally 'connector' should be the source of truth or be explicitly updated.
            console.warn("Using authDetails from service's main config for testConnection after re-auth.");
            connector.authDetails = this.connectorConfig.authDetails;
        }
         if (!connector.authDetails?.accessToken) {
            console.error('Access token still not available on the connector for Fusion test call after auth attempt.');
            return false;
        }
      }

      try {
        const testResourcePath = 'fscmRestApi/resources/latest/describe';
        console.log(`Attempting Fusion test call to: ${connector.auth_config.base_url}/${testResourcePath}`);
        
        const response = await this.fetchData(connector, {
          resourcePath: testResourcePath,
          method: 'GET',
          timeout: 15000
        });

        if (response && response.status >= 200 && response.status < 300) {
          console.log('Successfully connected to Oracle Fusion Cloud ERP. Test endpoint responded.', response.status);
          return true;
        } else {
          console.error('Failed to connect to Oracle Fusion Cloud ERP. Test endpoint responded with status:', response?.status, response?.data);
          return false;
        }
      } catch (error: any) {
        console.error('Error during Oracle Fusion Cloud ERP connection test:', error.response?.data || error.message);
        return false;
      }
    } else if (connector.erp_type === 'netsuite') {
      console.log('Testing connection to Oracle NetSuite...');
      if (!connector.auth_config?.account_id) {
         console.error('Missing account_id in auth_config for NetSuite connection test.');
         return false;
      }
      // Verify config by calling authenticate. For NetSuite, this populates authDetails with config if valid.
      const configVerified = await this.authenticate(); // Uses this.connectorConfig
      if (!configVerified) {
          console.error('NetSuite TBA configuration verification failed during testConnection.');
          return false;
      }
      // Similar to Fusion, ensure 'connector' has the authDetails if it's not this.connectorConfig
      if (this.connectorConfig === connector && this.connectorConfig.authDetails) {
          connector.authDetails = this.connectorConfig.authDetails;
      } else if (!connector.authDetails && this.connectorConfig.authDetails) {
          console.warn("Using authDetails from service's main config for NetSuite testConnection.");
          connector.authDetails = this.connectorConfig.authDetails;
      }
      if (!connector.authDetails?.consumerKey) { // Check a key property from NetSuite's authDetails
          console.error('NetSuite authDetails not available on the connector for test call after auth config verification.');
          return false;
      }

      try {
        const testResourcePath = 'record/v1/customer/!metadata-catalog';
        console.log(`Attempting NetSuite test call to resource: ${testResourcePath}`);
        
        const response = await this.fetchData(connector, {
          resourcePath: testResourcePath,
          method: 'GET',
          timeout: 30000
        });

        if (response && response.status >= 200 && response.status < 300) {
          console.log('Successfully connected to Oracle NetSuite. Test endpoint responded.', response.status);
          return true;
        } else {
          console.error('Failed to connect to Oracle NetSuite. Test endpoint responded with status:', response?.status, response?.data);
          return false;
        }
      } catch (error: any) {
        console.error('Error during Oracle NetSuite connection test:', error.response?.data || error.message);
        return false;
      }
    }
    
    console.error(`Unsupported erp_type for testConnection: ${connector.erp_type}`);
    return false;
  }

  // Add other methods as needed for specific Oracle ERP interactions based on documentation
}
