# Oracle ERP Connector: Next Steps

## Current Status

The foundational work for the Oracle ERP connector within the `my-nextjs-app/connector-service` is complete:

1.  **`OracleERPService.ts` (`my-nextjs-app/connector-service/src/services/OracleERPService.ts`):**
    *   This service class extends `AbstractExternalService`.
    *   It is structured to handle connections to different types of Oracle ERP systems, specifically **Oracle Fusion Cloud ERP** and **Oracle NetSuite**.
    *   Methods for `authenticate`, `fetchData`, and `testConnection` include conditional logic based on an `erp_type` property.
    *   Placeholder comments and example code snippets using `axios` are in place to guide the implementation of actual API calls for both Fusion and NetSuite.

2.  **`connector.types.ts` (`my-nextjs-app/connector-service/src/types/connector.types.ts`):**
    *   The `IntegrationConnector` interface has been updated with an optional `erp_type?: 'fusion' | 'netsuite' | string;` field. This field will be used by `OracleERPService` to determine which ERP system's API and authentication logic to use.

## Next Major Phase: Detailed API Implementation

The immediate and most crucial next step is to implement the specific API interaction logic within the `// TODO:` sections of `OracleERPService.ts`. This involves:

### For Oracle Fusion Cloud ERP (erp_type: 'fusion'):
*   **Authentication:**
    *   Implement the chosen authentication mechanism (likely OAuth 2.0, as suggested by Oracle Fusion Cloud Financials REST API documentation).
    *   Handle token acquisition, storage (if applicable, via `connectorConfig.authDetails`), and refresh.
*   **Data Fetching (`fetchData`):**
    *   Implement calls to specific Fusion Cloud ERP REST API endpoints for relevant data entities (e.g., financials, purchase orders, inventory).
    *   Use `axios` for requests, incorporating appropriate headers (e.g., Authorization Bearer token) and parameters based on `options: ExternalServiceRequestOptions`.
    *   Parse responses and handle potential API errors.
*   **Connection Testing (`testConnection`):**
    *   Implement a call to a stable, non-destructive Fusion Cloud ERP API endpoint (e.g., a metadata or health check endpoint like `/fscmRestApi/resources/11.13.18.05/describe`) to verify connectivity and authentication.

### For Oracle NetSuite (erp_type: 'netsuite'):
*   **Authentication:**
    *   Implement the chosen authentication mechanism for SuiteTalk REST Web Services (likely Token-Based Authentication - TBA, or OAuth 2.0).
    *   Handle the creation of necessary authentication headers.
    *   Store and manage tokens/credentials via `connectorConfig.authDetails`.
*   **Data Fetching (`fetchData`):**
    *   Implement calls to specific SuiteTalk REST API endpoints. NetSuite URLs are often account-specific, so the base URL will come from `connectorConfig`.
    *   Handle operations for various record types (e.g., customer, salesOrder, inventoryItem) using CRUD operations and the SuiteQL query service if needed.
    *   Use `axios` for requests, incorporating appropriate headers and parameters.
    *   Parse responses and handle API errors.
*   **Connection Testing (`testConnection`):**
    *   Implement a call to a stable SuiteTalk REST API endpoint (e.g., fetching metadata for a common record type like `customer/!metadata-catalog`) to verify connectivity and authentication.

**Note:** This phase requires careful study of the relevant Oracle API documentation (previously scraped links for Fusion, and the SuiteTalk REST Web Services API Guide for NetSuite) to ensure correct implementation of endpoints, request/response structures, and authentication protocols.

## Subsequent Steps (Post-API Implementation)

Once `OracleERPService` can reliably authenticate and exchange data with both Oracle Fusion and NetSuite:

1.  **Configuration Management:**
    *   Ensure `IntegrationConnector`'s `auth_config` and `api_spec` fields in `connector.types.ts` are robust enough to store all necessary configuration details for both ERP types (e.g., tenant-specific base URLs, client IDs/secrets, token URLs, account IDs, API versions, custom headers if any).
    *   Update any UI or backend logic responsible for creating/managing `IntegrationConnector` entities to capture these details.

2.  **Thorough Testing:**
    *   Write comprehensive unit tests for `OracleERPService`, covering both Fusion and NetSuite logic paths.
    *   Conduct integration tests against sandbox/test instances of Oracle Fusion and NetSuite if available.

3.  **Integration with `ConnectorManager` (for Auth Strategies):**
    *   If Oracle Fusion or NetSuite use standard authentication flows like OAuth 2.0 that can be generalized, consider creating and registering corresponding `IAuthStrategy` implementations with the `ConnectorManager`. `OracleERPService` could then potentially leverage `ConnectorManager` for parts of the authentication flow (e.g., token management).

4.  **Data Synchronization:**
    *   Integrate `OracleERPService`'s `fetchData` capabilities with the `SyncFramework` (used by `ConnectorManager.synchronizeConnectorData`) to enable bi-directional data synchronization if required by the use case.

5.  **RAG Pipeline Integration:**
    *   Ensure that data fetched via `OracleERPService` and synchronized can be correctly processed and indexed by the RAG pipeline's `indexTenantData` function (`my-nextjs-app/src/lib/agents/ragPipeline.ts`) for use by SEED agents.

6.  **UI Development:**
    *   Develop UI components in the Next.js application (`my-nextjs-app`) for tenants to:
        *   Configure their Oracle ERP connections (selecting ERP type - Fusion/NetSuite, providing endpoints, credentials, etc.).
        *   Manage and monitor their ERP integration.
        *   View/interact with data fetched from their ERP (as per application requirements).
    *   Apply Next.js best practices for data fetching and server actions (using the guidance previously scraped).

This detailed plan should guide the subsequent development efforts for the Oracle ERP connector.
