# Connector Service: Detailed Implementation Plan (Subtask 4.1)

This document outlines the detailed implementation plan for the initial `connector-service` microservice, based on the architectural designs from Subtask 1.1 (Microservices Foundation) and Subtask 1.2 (Core Connector Framework).

## 1. Supabase Schema Implementation (`integration_connectors` Table)

The following SQL DDL statements will be used to create the `integration_connectors` table in Supabase. This schema is based on the design from Subtask 1.2.

```sql
CREATE TABLE public.integration_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    connector_name TEXT NOT NULL,
    service_name TEXT NOT NULL, -- e.g., 'google-calendar', 'jira', 'salesforce'
    auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth2', 'apikey', 'basic', 'custom')),
    auth_config JSONB NOT NULL,
    -- Example for 'apikey': {"api_key_name": "X-API-KEY", "key_location": "header", "secret_key_vault_path": "kv/data/tenant_xyz/connector_abc/api_key"}
    -- Example for 'oauth2': {"client_id_vault_path": "...", "client_secret_vault_path": "...", "auth_url": "...", "token_url": "...", "redirect_uri": "..."}
    api_spec JSONB, -- Optional: OpenAPI spec or relevant API metadata
    scopes TEXT[], -- e.g., ['calendar.readonly', 'issues.write']
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_connected_at TIMESTAMPTZ,
    last_error JSONB,
    metadata JSONB, -- For any additional connector-specific information

    CONSTRAINT uq_tenant_connector_name UNIQUE (tenant_id, connector_name),
    CONSTRAINT fk_tenant
        FOREIGN KEY(tenant_id)
        REFERENCES tenants(id) -- Assuming a 'tenants' table exists
        ON DELETE CASCADE
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.integration_connectors ENABLE ROW LEVEL SECURITY;

-- Policies for RLS (examples, adjust based on actual auth model)
CREATE POLICY "Allow individual read access"
ON public.integration_connectors
FOR SELECT
USING (auth.uid() = tenant_id); -- Or based on a role/claim that maps to tenant_id

CREATE POLICY "Allow individual write access"
ON public.integration_connectors
FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Allow individual update access"
ON public.integration_connectors
FOR UPDATE
USING (auth.uid() = tenant_id);

CREATE POLICY "Allow individual delete access"
ON public.integration_connectors
FOR DELETE
USING (auth.uid() = tenant_id);

-- Trigger to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at
BEFORE UPDATE ON public.integration_connectors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_integration_connectors_tenant_id ON public.integration_connectors(tenant_id);
CREATE INDEX idx_integration_connectors_service_name ON public.integration_connectors(service_name);
CREATE INDEX idx_integration_connectors_auth_type ON public.integration_connectors(auth_type);

COMMENT ON COLUMN public.integration_connectors.auth_config IS 'Stores authentication configuration. For API Key, it might include the key name, location (header/query), and vault path for the secret. For OAuth2, client ID/secret vault paths, auth/token URLs, etc.';
COMMENT ON COLUMN public.integration_connectors.api_spec IS 'Optional: Stores relevant parts of an OpenAPI spec or other API metadata for the connected service.';
```

## 2. `connector-service` API Endpoints

The `connector-service` will expose the following initial RESTful API endpoints. These will be consumed by the Next.js BFF (Route Handlers).

**Base Path:** `/api/v1/connectors` (within the microservice, actual path exposed by BFF might differ)

---

### 2.1. Manage Connector Configurations

#### `POST /configurations`
*   **Description:** Create a new connector configuration.
*   **Request Body Schema (application/json):**
    ```json
    {
      "tenant_id": "uuid",
      "connector_name": "string (user-defined, unique per tenant)",
      "service_name": "string (e.g., 'google-drive', 'slack')",
      "auth_type": "string (enum: 'oauth2', 'apikey', 'basic')",
      "auth_config": {
        // Schema varies based on auth_type
        // Example for 'apikey':
        // "api_key_name": "X-Custom-API-Key", (header name or query param name)
        // "key_location": "header", (enum: 'header', 'query')
        // "secret_key_vault_path": "string (path to secret in vault)"
      },
      "api_spec": "object (optional, e.g., OpenAPI subset)",
      "scopes": ["string"],
      "metadata": "object (optional)"
    }
    ```
*   **Response Schema (201 Created - application/json):**
    ```json
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "connector_name": "string",
      "service_name": "string",
      "auth_type": "string",
      "auth_config": "object",
      "api_spec": "object",
      "scopes": ["string"],
      "is_active": true,
      "created_at": "timestamp",
      "updated_at": "timestamp",
      "metadata": "object"
    }
    ```
*   **Error Responses:** 400 (Bad Request), 401 (Unauthorized), 409 (Conflict if name exists for tenant)

#### `GET /configurations`
*   **Description:** List all connector configurations for a tenant.
*   **Query Parameters:**
    *   `tenant_id` (required, uuid)
    *   `service_name` (optional, string)
    *   `is_active` (optional, boolean)
*   **Response Schema (200 OK - application/json):**
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "connector_name": "string",
          "service_name": "string",
          "auth_type": "string",
          "is_active": true,
          "created_at": "timestamp",
          "updated_at": "timestamp"
        }
      ],
      "pagination": {
        "offset": 0,
        "limit": 20,
        "total": 1
      }
    }
    ```
*   **Error Responses:** 400 (Bad Request), 401 (Unauthorized)

#### `GET /configurations/{connectorId}`
*   **Description:** Get a specific connector configuration.
*   **Path Parameters:**
    *   `connectorId` (uuid)
*   **Response Schema (200 OK - application/json):** (Same as POST response)
*   **Error Responses:** 401 (Unauthorized), 404 (Not Found)

#### `PUT /configurations/{connectorId}`
*   **Description:** Update an existing connector configuration.
*   **Path Parameters:**
    *   `connectorId` (uuid)
*   **Request Body Schema (application/json):** (Subset of POST request, fields to update)
*   **Response Schema (200 OK - application/json):** (Same as POST response)
*   **Error Responses:** 400 (Bad Request), 401 (Unauthorized), 404 (Not Found)

#### `DELETE /configurations/{connectorId}`
*   **Description:** Delete a connector configuration.
*   **Path Parameters:**
    *   `connectorId` (uuid)
*   **Response Schema (204 No Content):**
*   **Error Responses:** 401 (Unauthorized), 404 (Not Found)

---

### 2.2. Connector Operations

#### `POST /connectors/{connectorId}/test-connection`
*   **Description:** Test the connection for a configured connector.
*   **Path Parameters:**
    *   `connectorId` (uuid)
*   **Response Schema (200 OK - application/json):**
    ```json
    {
      "status": "string (enum: 'success', 'failure')",
      "message": "string (optional, details on success or error)",
      "tested_at": "timestamp"
    }
    ```
*   **Error Responses:** 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 502 (Bad Gateway if external service fails)

#### `GET /connectors/{connectorId}/data`
*   **Description:** Fetch data from a connected service using a specific connector. (This is a generic placeholder; specific data fetching endpoints will be more granular based on `service_name` and `api_spec`).
*   **Path Parameters:**
    *   `connectorId` (uuid)
*   **Query Parameters:**
    *   `resource_path`: "string" (e.g., "/users", "/files/fileId")
    *   Other query params specific to the external API.
*   **Response Schema (200 OK - application/json):**
    ```json
    {
      "data": "object or array (actual data from external service)",
      "source_metadata": {
        "request_url": "string",
        "status_code": "integer"
      }
    }
    ```
*   **Error Responses:** 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 502 (Bad Gateway)

#### `POST /connectors/{connectorId}/actions`
*   **Description:** Perform an action on a connected service. (Generic placeholder).
*   **Path Parameters:**
    *   `connectorId` (uuid)
*   **Request Body Schema (application/json):**
    ```json
    {
        "action_name": "string", // e.g., "create_issue", "send_message"
        "payload": {} // action-specific payload
    }
    ```
*   **Response Schema (200 OK - application/json):**
    ```json
    {
        "status": "success",
        "result": {} // action-specific result
    }
    ```
*   **Error Responses:** 400, 401, 404, 502

---

## 3. Directory Structure & Key Files (`connector-service`)

Proposed directory structure for the Node.js/TypeScript `connector-service`:

```
connector-service/
├── dist/                     # Compiled JavaScript files
├── node_modules/             # Project dependencies
├── src/
│   ├── api/                  # API route handlers and validation
│   │   ├── v1/
│   │   │   ├── configurations.routes.ts
│   │   │   ├── connectors.routes.ts
│   │   │   └── index.ts      # Aggregates v1 routes
│   │   └── middleware/
│   │       ├── errorHandler.ts
│   │       ├── requestLogger.ts
│   │       └── tenantAuth.ts # Example: Middleware to verify tenant context
│   ├── config/               # Configuration loading (env vars, vault)
│   │   ├── index.ts
│   │   └── vault.ts          # Vault/Secrets manager client
│   ├── core/                 # Core business logic
│   │   ├── auth/             # Authentication strategies for external services
│   │   │   ├── ApiKeyStrategy.ts
│   │   │   ├── OAuth2Strategy.ts
│   │   │   └── IAuthStrategy.ts
│   │   ├── ConnectorManager.ts # Manages connector instances and operations
│   │   └── ServiceHandlerFactory.ts # Creates handlers for specific services
│   ├── db/                   # Database interaction (Supabase client)
│   │   ├── supabaseClient.ts
│   │   └── repositories/
│   │       └── ConnectorRepository.ts
│   ├── services/             # External service interaction logic
│   │   ├── AbstractExternalService.ts
│   │   └── impl/             # Implementations for specific services (e.g., GoogleDriveService.ts)
│   ├── types/                # TypeScript type definitions and interfaces
│   │   ├── api.types.ts
│   │   └── connector.types.ts
│   ├── utils/                # Utility functions
│   │   └── logger.ts
│   ├── app.ts                # Express app setup, middleware, routes
│   └── server.ts             # Main service entry point (HTTP server)
├── tests/
│   ├── integration/
│   └── unit/
├── .env.example              # Example environment variables
├── .eslintrc.js
├── .gitignore
├── .prettierrc.json
├── Dockerfile
├── package.json
├── README.md
└── tsconfig.json
```

**Key Files/Modules:**

*   **`src/server.ts`**: Initializes and starts the HTTP server.
*   **`src/app.ts`**: Configures the Express application (or similar framework like Fastify), including middleware (logging, error handling, auth) and API routes.
*   **`src/config/index.ts`**: Loads and provides access to application configuration (environment variables, secrets from vault).
*   **`src/config/vault.ts`**: Contains logic for interacting with the secrets manager (e.g., HashiCorp Vault).
*   **`src/db/supabaseClient.ts`**: Initializes and exports the Supabase client.
*   **`src/db/repositories/ConnectorRepository.ts`**: Handles CRUD operations for `integration_connectors` in Supabase.
*   **`src/api/v1/configurations.routes.ts`**: Defines routes for managing connector configurations.
*   **`src/api/v1/connectors.routes.ts`**: Defines routes for connector operations (test, fetch data).
*   **`src/core/auth/IAuthStrategy.ts` & implementations**: Defines the interface and concrete strategies for different authentication mechanisms (API Key, OAuth2).
*   **`src/core/ConnectorManager.ts`**: Core logic for loading connector configurations, instantiating auth strategies, and interacting with external services.
*   **`src/services/AbstractExternalService.ts`**: Base class or interface for specific service handlers.

## 4. Dockerfile for `connector-service`

```dockerfile
# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# Transpile TypeScript to JavaScript
RUN pnpm run build # Assumes a "build" script in package.json (e.g., "tsc")

# Prune dev dependencies
RUN pnpm prune --prod

# Stage 2: Production image
FROM node:18-alpine

WORKDIR /usr/src/app

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy built application and production dependencies from builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package.json .

# Expose the application port
EXPOSE 3001 # Or whatever port the service listens on

# Command to run the application
CMD ["node", "dist/server.js"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/api/v1/health || exit 1
```
**Notes on Dockerfile:**
*   Uses multi-stage builds for smaller production images.
*   Assumes `pnpm` for package management, adjust if using `npm` or `yarn`.
*   Assumes a `build` script in `package.json` (e.g., `tsc -p .`).
*   Includes a basic `HEALTHCHECK` endpoint (assumed to be `/api/v1/health`). This should be implemented in the service.
*   Runs the application as a non-root user.

## 5. Updates to `docker-compose.yml`

Add the following service definition to the project's `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # ... other services (e.g., nextjs-bff, supabase, postgres, vault, kafka)

  connector-service:
    build:
      context: ./connector-service # Path to the connector-service directory
      dockerfile: Dockerfile
    container_name: connector-service
    restart: unless-stopped
    ports:
      - "3001:3001" # Expose port 3001 on the host
    env_file:
      - ./connector-service/.env # Load environment variables from .env file
    environment:
      - NODE_ENV=development
      - PORT=3001
      - SUPABASE_URL=${SUPABASE_URL} # From host .env or global docker-compose .env
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY} # From host .env or global docker-compose .env
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY} # For admin operations if needed
      - VAULT_ADDR=${VAULT_ADDR:-http://vault:8200} # Address of the Vault service
      - VAULT_TOKEN=${VAULT_DEV_ROOT_TOKEN_ID} # For development; use AppRole or other auth in prod
      # Add other necessary environment variables
    depends_on:
      - supabase # Ensure Supabase (or its Postgres DB) is up
      - vault    # Ensure Vault is up if used for secrets
    networks:
      - app-network # Assuming a common network for services

  # ... potentially a vault service for local development
  # vault:
  #   image: hashicorp/vault:latest
  #   container_name: vault
  #   ports:
  #     - "8200:8200"
  #   environment:
  #     VAULT_DEV_ROOT_TOKEN_ID: "myroottoken" # For dev only
  #     VAULT_DEV_LISTEN_ADDRESS: "0.0.0.0:8200"
  #   cap_add:
  #     - IPC_LOCK
  #   networks:
  #     - app-network

# networks:
#   app-network:
#     driver: bridge
```
**Notes on `docker-compose.yml`:**
*   Assumes the `connector-service` code is in a directory named `connector-service` at the same level as the `docker-compose.yml` or as specified by `context`.
*   References an `.env` file within the `connector-service` directory for service-specific configurations.
*   Includes placeholders for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAULT_ADDR`, and `VAULT_TOKEN`. These should be managed securely, potentially through a global `.env` file for Docker Compose or injected at runtime in production.
*   `depends_on` ensures services start in a reasonable order.
*   A common `app-network` is assumed for inter-service communication.
*   A basic Vault service definition is commented out as an example for local development.

## 6. Initial Authentication Logic Outline (API Key Example)

This outlines how the `connector-service` will handle authentication to an external service using an API Key, as configured in `integration_connectors.auth_config`.

**Scenario:** A connector configuration in Supabase has `auth_type: 'apikey'` and `auth_config` like:
```json
{
  "api_key_name": "X-ThirdParty-ApiKey", // Name of the header or query param
  "key_location": "header",             // 'header' or 'query'
  "secret_key_vault_path": "kv/data/tenant_xyz/connectors/service_abc/api_key" // Path in Vault
}
```

**Steps within `connector-service`:**

1.  **Configuration Retrieval (`ConnectorManager.ts` or similar):**
    *   When an operation is requested for a `connectorId`, the `ConnectorManager` fetches the corresponding configuration from Supabase (via `ConnectorRepository.ts`).
    *   It checks if `auth_type` is `'apikey'`.

2.  **Secret Retrieval (`Vault.ts`, `ApiKeyStrategy.ts`):**
    *   The `ApiKeyStrategy` is instantiated with the `auth_config`.
    *   It uses the `secret_key_vault_path` from `auth_config` to query the Vault service (e.g., HashiCorp Vault).
    *   The `Vault.ts` module handles the actual communication with Vault, authenticating itself to Vault (e.g., using an AppRole or a token provided via environment variable to the `connector-service`).
    *   The retrieved secret (the actual API key value) is securely handled and made available to the strategy. **It should not be logged or stored outside of memory for the duration of the request.**

3.  **Request Preparation (`ApiKeyStrategy.ts`, `AbstractExternalService.ts`):**
    *   The `ApiKeyStrategy`'s `prepareRequest` method (or similar) takes an outgoing HTTP request object (e.g., for `axios` or `node-fetch`).
    *   Based on `key_location` ('header' or 'query') and `api_key_name` from `auth_config`, it adds the API key to the request:
        *   If `key_location` is 'header': `request.headers[auth_config.api_key_name] = retrieved_api_key;`
        *   If `key_location` is 'query': `request.params[auth_config.api_key_name] = retrieved_api_key;`

4.  **External API Call (`AbstractExternalService.ts` or specific service implementation):**
    *   The modified request (now including the API key) is sent to the external service.

5.  **Error Handling:**
    *   If secret retrieval from Vault fails, an appropriate error is returned/logged.
    *   If the external API call fails due to an invalid API key (e.g., 401/403 from the external service), this should be logged, and potentially the `last_error` field in `integration_connectors` table updated.

**Security Considerations:**
*   The `connector-service` itself needs a secure way to authenticate to Vault (e.g., Vault Agent, AppRole, Kubernetes Auth).
*   API keys (secrets) should never be logged.
*   Minimize the time an API key is held in memory.
*   Implement caching for retrieved secrets from Vault with appropriate TTLs if performance becomes an issue, but be mindful of cache security.

## 7. Task Breakdown for Coding

Primary coding tasks to implement this initial version of the `connector-service`:

1.  **Project Setup:**
    *   Initialize Node.js/TypeScript project (`pnpm init`, install base dependencies like Express, TypeScript, ESLint, Prettier).
    *   Configure `tsconfig.json`, `.eslintrc.js`, `.prettierrc.json`.
    *   Create the directory structure outlined in Section 3.

2.  **Configuration & Utilities:**
    *   Implement `src/config/index.ts` for environment variable loading.
    *   Implement `src/utils/logger.ts` (e.g., using Winston or Pino).
    *   Implement `src/api/middleware/requestLogger.ts` and `errorHandler.ts`.

3.  **Supabase Integration:**
    *   Implement `src/db/supabaseClient.ts`.
    *   Implement `src/db/repositories/ConnectorRepository.ts` with CRUD methods for `integration_connectors`.
    *   Apply the SQL DDL (Section 1) to the Supabase instance (manual or via migration tool).

4.  **Core Logic - Connector & Auth Management:**
    *   Define types/interfaces in `src/types/`.
    *   Implement `src/core/auth/IAuthStrategy.ts`.
    *   Implement `src/core/auth/ApiKeyStrategy.ts` (initially without Vault, then add Vault integration).
    *   Implement `src/core/ConnectorManager.ts` (methods to get config, prepare authenticated requests).

5.  **API Endpoints Implementation:**
    *   Implement route handlers in `src/api/v1/configurations.routes.ts` for CRUD operations on connectors.
        *   Include input validation (e.g., using Zod or Joi).
    *   Implement initial route handlers in `src/api/v1/connectors.routes.ts` (e.g., `/test-connection`).
    *   Set up Express app in `src/app.ts` and server in `src/server.ts`.
    *   Implement a basic `/health` endpoint.

6.  **Vault Integration (Secrets Management):**
    *   Implement `src/config/vault.ts` to connect to and read secrets from HashiCorp Vault (or chosen secrets manager).
    *   Integrate secret retrieval into `ApiKeyStrategy.ts`.

7.  **Dockerization:**
    *   Create the `Dockerfile` (Section 4).
    *   Add service definition to `docker-compose.yml` (Section 5).
    *   Create `.env.example` and a local `.env` file for the service.
    *   Test building and running the service via Docker Compose.

8.  **Testing:**
    *   Write unit tests for key components (e.g., `ApiKeyStrategy`, `ConnectorRepository`).
    *   Write integration tests for API endpoints (e.g., using Supertest).

9.  **Documentation:**
    *   Update/create `README.md` for the `connector-service` (setup, running, API overview).
    *   Document API endpoints (e.g., using Swagger/OpenAPI, can be auto-generated or manually written).

This detailed plan provides a solid foundation for implementing the `connector-service`.