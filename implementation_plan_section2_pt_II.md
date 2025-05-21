# Implementation Plan: SEED-OS Integration Layer - Section 2 Part II

This document outlines the implementation plan for the components described in "SEED Outline/section 2 pt II" from the Grand-Nobel/SEED-OS repository, focusing on their integration into the current Next.js project (`my-nextjs-app`).

## General Integration Principles:

*   **Next.js as BFF/Frontend:** The existing `my-nextjs-app` will serve as the primary user interface and Backend-For-Frontend (BFF). UI components will be React components. API interactions from the frontend will go through Next.js Route Handlers (`app/api/...`).
*   **Microservices:** New backend services will be implemented as Node.js/TypeScript microservices, similar in structure to the `connector-service`, containerized with Docker, and orchestrated with `docker-compose.yml`. They will reside within the `my-nextjs-app` directory for consolidated project structure (e.g., `my-nextjs-app/new-service/`).
*   **Supabase:** Used as the primary database. Schema changes will be managed via migration files.
*   **Modularity:** Components will be designed for modularity, even if initially co-located, to allow for future separation if needed.

---

## 2.6 Robust Bi-Directional Sync Framework

### 2.6.1 Component Goal
Ensure data consistency and performance for large datasets between integrated systems and the platform, supporting data sovereignty and trust using Yjs for conflict resolution.

### 2.6.2 Integration Strategy
*   **Location:** The core `SyncFramework` class and its logic will be integrated as a module within the existing `connector-service` (`my-nextjs-app/connector-service/src/core/sync/`). This service already handles connector configurations and is a natural place for managing data synchronization logic related to those connectors.
*   **Interaction:** The `ConnectorManager` or specific service handlers within `connector-service` will utilize the `SyncFramework` to process incoming and outgoing data.

### 2.6.3 Key Files/Modules to Create/Update
*   **New Files:**
    *   `my-nextjs-app/connector-service/src/core/sync/SyncFramework.ts`: Implements the `SyncFramework` class using Yjs, including methods for `syncData` and `exponentialBackoffRetry`.
    *   `my-nextjs-app/connector-service/src/types/sync.types.ts`: (If needed for specific sync-related types beyond Yjs).
*   **Update Files:**
    *   `my-nextjs-app/connector-service/src/core/ConnectorManager.ts` (or specific service handlers): To call `SyncFramework.syncData()` when data needs to be synchronized.
    *   `my-nextjs-app/connector-service/src/db/repositories/ConnectorRepository.ts`: To handle read/write of `sync_version` and `last_sync_at`.

### 2.6.4 Supabase Schema Changes
*   **Modify `integration_connectors` table** (in a new migration file, e.g., `supabase/migrations/YYYYMMDDHHMMSS_add_sync_to_connectors.sql`):
    *   Add `sync_version BYTEA` (or `JSONB` if storing Yjs updates as JSON, though `BYTEA` is more common for binary Yjs updates). The example uses `JSON`, but `BYTEA` is more appropriate for `Y.encodeStateAsUpdate`).
    *   Add `last_sync_at TIMESTAMPTZ`.
*   **Consider `audit_logs` table** (if not already present from section 2.13):
    ```sql
    CREATE TABLE IF NOT EXISTS public.audit_logs (
        id BIGSERIAL PRIMARY KEY,
        tenant_id UUID, -- Consider FK to tenants table
        user_id TEXT, -- Can be system or actual user UUID
        action TEXT NOT NULL,
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL -- Example FK
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
    ```

### 2.6.5 Docker/`docker-compose.yml` Changes
*   No changes if integrated into `connector-service`.

### 2.6.6 Next.js Specific Considerations
*   None directly for the backend framework. Sync operations would be triggered by backend logic.

### 2.6.7 Dependencies to Add
*   To `my-nextjs-app/connector-service/package.json`:
    *   `yjs`

---

## 2.7 Integration Marketplace

### 2.7.1 Component Goal
Allow users to discover, install, and configure connectors via a UI.

### 2.7.2 Integration Strategy
*   **Marketplace UI:**
    *   **Location:** React components within the Next.js frontend (`my-nextjs-app/src/components/integrations/marketplace/`).
    *   **Interaction:** Fetches available connectors and triggers installation via Next.js Route Handlers.
*   **Marketplace Backend (API):**
    *   **Location:** A new microservice, `marketplace-service` (`my-nextjs-app/marketplace-service/`). This aligns with the provided example of an Express app.
    *   **Interaction:** Exposes endpoints for listing marketplace connectors and handling installation requests. Interacts with Supabase for connector metadata and `integration_connectors` table.
*   **Next.js BFF:**
    *   **Location:** Route Handlers in `my-nextjs-app/src/app/api/integrations/marketplace/`.
    *   **Interaction:** Proxies requests from the Marketplace UI to the `marketplace-service`.

### 2.7.3 Key Files/Modules to Create/Update
*   **New `marketplace-service` Microservice (`my-nextjs-app/marketplace-service/`):**
    *   Standard Node.js/TypeScript structure (similar to `connector-service`).
    *   `src/index.ts` or `src/server.ts`: Express app setup.
    *   `src/routes/connectors.routes.ts`: Endpoints for `/connectors` (list) and `/install`.
    *   `src/db/supabaseClient.ts`: Supabase client instance.
    *   `src/types/marketplace.types.ts`: Types for marketplace connectors.
    *   `Dockerfile`, `package.json`, `tsconfig.json`.
*   **New Next.js Frontend Components (`my-nextjs-app/src/components/integrations/marketplace/`):**
    *   `Marketplace.tsx`: Main UI component.
    *   `ConnectorCard.tsx`: Component to display individual connectors.
*   **New Next.js Route Handlers (`my-nextjs-app/src/app/api/integrations/marketplace/`):**
    *   `connectors/route.ts`: Fetches connector list from `marketplace-service`.
    *   `install/route.ts`: Handles installation requests, calls `marketplace-service`.

### 2.7.4 Supabase Schema Changes
*   **New `marketplace_connectors` table** (in a new migration file, e.g., `supabase/migrations/YYYYMMDDHHMMSS_create_marketplace_connectors.sql`):
    ```sql
    CREATE TABLE public.marketplace_connectors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        service_identifier TEXT NOT NULL UNIQUE, -- e.g., 'google-drive', 'slack', used to map to service_name in integration_connectors
        logo_url TEXT,
        category TEXT,
        vendor TEXT,
        default_auth_config JSONB, -- Default configuration template for auth_config
        default_api_spec JSONB,    -- Default API spec template
        available_scopes TEXT[],
        setup_guide_url TEXT,
        is_featured BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    -- Trigger for updated_at
    CREATE TRIGGER handle_marketplace_connectors_updated_at
    BEFORE UPDATE ON public.marketplace_connectors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); -- Assuming update_updated_at_column function exists
    ```
*   The `marketplace-service` will insert into `integration_connectors` upon installation.

### 2.7.5 Docker/`docker-compose.yml` Changes
*   Add `marketplace-service` to [`docker-compose.yml`](docker-compose.yml:0):
    ```yaml
    # ... other services
    marketplace-service:
      build:
        context: ./my-nextjs-app/marketplace-service
        dockerfile: Dockerfile
      container_name: marketplace-service
      restart: unless-stopped
      ports:
        - "3005:3005" # As per example
      env_file:
        - ./my-nextjs-app/.env.local # Or a dedicated .env for this service
      environment:
        - NODE_ENV=development
        - PORT=3005
        - SUPABASE_URL=${SUPABASE_URL}
        - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
        # SUPABASE_SERVICE_ROLE_KEY if needed for admin operations
      networks:
        - app-network
      depends_on:
        - supabase # If direct Supabase connection
    ```

### 2.7.6 Next.js Specific Considerations
*   Marketplace UI will be client components fetching data via server-side Route Handlers.
*   Authentication for install actions needs to be handled (user context passed to BFF).

### 2.7.7 Dependencies to Add
*   To `my-nextjs-app/marketplace-service/package.json`:
    *   `express`, `typescript`, `@types/express`, `pino` (for logging), `@supabase/supabase-js`, `cors`, `helmet`.
*   To `my-nextjs-app/package.json` (for frontend):
    *   Standard UI libraries if not already present.

---

## 2.8 Connector Performance Monitoring

### 2.8.1 Component Goal
Monitor connector performance (latency, error rates, throughput) and alert on anomalies.

### 2.8.2 Integration Strategy
*   **Metrics Collection:**
    *   **Location:** Integrate `prom-client` directly into services that perform external calls, primarily the `connector-service`. The `ConnectorManager` or individual service handlers can expose a `/metrics` endpoint for Prometheus to scrape.
*   **Metrics Storage (Long-term):**
    *   **Location:** The example shows logging metrics to a Supabase table (`connector_metrics`). This can be done via an async call from the service collecting metrics.
*   **Visualization & Alerting:**
    *   **Tools:** Prometheus and Grafana, deployed as separate services managed by Docker Compose for local development.
*   **No dedicated "Monitoring Service" microservice initially.** Metric emission is decentralized, aggregation is by Prometheus.

### 2.8.3 Key Files/Modules to Create/Update
*   **Update `my-nextjs-app/connector-service/src/core/ConnectorManager.ts` (and/or service handlers):**
    *   Import and use `prom-client` to define and update Prometheus metrics (Gauge for latency, Counter for errors, Histogram for request duration).
    *   Add logic to asynchronously write metrics to the `connector_metrics` Supabase table.
*   **Update `my-nextjs-app/connector-service/src/app.ts`:**
    *   Add a `/metrics` endpoint to expose Prometheus metrics:
      ```typescript
      // In app.ts
      import { register } from 'prom-client';
      // ...
      app.get('/metrics', async (req, res) => {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      });
      ```
*   **New Prometheus Configuration (`./prometheus/prometheus.yml`):**
    ```yaml
    global:
      scrape_interval: 15s
    scrape_configs:
      - job_name: 'connector-service'
        static_configs:
          - targets: ['connector-service:3001'] # Assumes port 3001 and service name in Docker network
      # Add other services to scrape here
    ```
*   **New Grafana Configuration/Provisioning (Optional, for pre-built dashboards):**
    *   `./grafana/provisioning/dashboards/dashboard.yml`
    *   `./grafana/provisioning/datasources/datasource.yml`
    *   JSON dashboard definitions.

### 2.8.4 Supabase Schema Changes
*   **New `connector_metrics` table** (in a new migration file, e.g., `supabase/migrations/YYYYMMDDHHMMSS_create_connector_metrics.sql`):
    ```sql
    CREATE TABLE public.connector_metrics (
        id BIGSERIAL PRIMARY KEY,
        tenant_id UUID,
        connector_id UUID, -- FK to integration_connectors.id
        connector_name TEXT, -- Denormalized for easier querying, or join
        service_name TEXT,   -- Denormalized
        metric_type TEXT NOT NULL, -- e.g., 'latency_ms', 'error_count', 'throughput_rpm'
        value DOUBLE PRECISION,
        labels JSONB, -- For additional metric dimensions
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_metrics_connector FOREIGN KEY (connector_id) REFERENCES integration_connectors(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_connector_metrics_timestamp ON public.connector_metrics(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_connector_metrics_connector_id ON public.connector_metrics(connector_id);
    CREATE INDEX IF NOT EXISTS idx_connector_metrics_metric_type ON public.connector_metrics(metric_type);
    ```
    (The example schema is simpler; the one above is more structured for querying).

### 2.8.5 Docker/`docker-compose.yml` Changes
*   Add Prometheus and Grafana services to [`docker-compose.yml`](docker-compose.yml:0):
    ```yaml
    # ... other services
    prometheus:
      image: prom/prometheus:v2.47.0
      container_name: prometheus
      ports:
        - "9090:9090"
      volumes:
        - ./prometheus:/etc/prometheus/ # Mount local prometheus.yml
        # - prometheus_data:/prometheus # Optional: persist Prometheus data
      command:
        - '--config.file=/etc/prometheus/prometheus.yml'
      networks:
        - app-network
      restart: unless-stopped

    grafana:
      image: grafana/grafana:10.1.1
      container_name: grafana
      ports:
        - "3000:3000"
      # volumes:
        # - grafana_data:/var/lib/grafana # Optional: persist Grafana data
        # - ./grafana/provisioning:/etc/grafana/provisioning/ # Optional: for provisioning datasources/dashboards
      environment:
        - GF_SECURITY_ADMIN_USER=admin
        - GF_SECURITY_ADMIN_PASSWORD=admin # Change in production
        - GF_USERS_ALLOW_SIGN_UP=false
      networks:
        - app-network
      depends_on:
        - prometheus
      restart: unless-stopped
    
    # volumes: # Optional
    #   prometheus_data:
    #   grafana_data:
    ```
*   Ensure `connector-service` exposes its `/metrics` endpoint if not on the main port.

### 2.8.6 Dependencies to Add
*   To `my-nextjs-app/connector-service/package.json`:
    *   `prom-client`

---

## 2.9 AI-Driven Connector Recommendations

### 2.9.1 Component Goal
Suggest relevant connectors to tenants based on their profile and usage patterns.

### 2.9.2 Integration Strategy
*   **Recommendation Logic:**
    *   **Location:** Implement the `RecommendationEngine` class as a module within the `marketplace-service` (`my-nextjs-app/marketplace-service/src/core/recommendations/`).
    *   **Interaction:** The `marketplace-service` will have an endpoint (e.g., `/recommendations`) that the Next.js BFF can call.
*   **Data Source:** Supabase `tenants` table (assumed to exist or needs creation) and potentially `integration_connectors` (for usage patterns).
*   **UI Integration:**
    *   **Location:** The Marketplace UI in the Next.js app (`my-nextjs-app/src/components/integrations/marketplace/Marketplace.tsx`) will fetch and display these recommendations.

### 2.9.3 Key Files/Modules to Create/Update
*   **New Files in `my-nextjs-app/marketplace-service/`:**
    *   `src/core/recommendations/RecommendationEngine.ts`: Implements the `RecommendationEngine` class.
    *   `src/routes/recommendations.routes.ts`: New route for `/recommendations` endpoint.
*   **Update Files in `my-nextjs-app/marketplace-service/`:**
    *   `src/index.ts` or `src/server.ts`: To mount the new recommendations route.
*   **Update Files in `my-nextjs-app/` (Frontend):**
    *   `src/components/integrations/marketplace/Marketplace.tsx`: To fetch and display recommendations.
    *   `src/app/api/integrations/marketplace/recommendations/route.ts`: New BFF endpoint to proxy to `marketplace-service`.

### 2.9.4 Supabase Schema Changes
*   **`tenants` table (Assumed/Needs Creation):**
    ```sql
    CREATE TABLE IF NOT EXISTS public.tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        industry TEXT,
        size INT, -- e.g., number of employees
        -- other tenant-specific profile data
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    -- Trigger for updated_at
    CREATE TRIGGER handle_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ```
    (The example `RecommendationEngine` uses `connectors` array on `tenants` table. This implies storing currently used connectors per tenant, which might be redundant if `integration_connectors` already links to `tenant_id`. The engine logic might need to query `integration_connectors` instead or this field needs careful consideration.)

### 2.9.5 Docker/`docker-compose.yml` Changes
*   None beyond the `marketplace-service` already defined.

### 2.9.6 Dependencies to Add
*   None specific beyond those for `marketplace-service`.

---

## 2.10 Offline-First Integration Support

### 2.10.1 Component Goal
Queue integration actions locally when offline and sync upon reconnection.

### 2.10.2 Integration Strategy
*   **Client-Side Queueing:**
    *   **Location:** Implement the `OfflineQueue` class and logic within the Next.js frontend (`my-nextjs-app/src/lib/integrations/offline/`).
    *   **Storage:** Use IndexedDB via the `idb` library.
*   **Sync Trigger & Processing:**
    *   **Trigger:** Network reconnection detection in the frontend (e.g., `navigator.onLine`, Service Worker events).
    *   **Processing:**
        *   Option A (as per example): Call a Supabase Edge Function or a dedicated RPC (`process_integration_action`).
        *   Option B: Call a new endpoint on the Next.js BFF, which then forwards to the appropriate service (e.g., `connector-service`). This might be preferable for consistency.

### 2.10.3 Key Files/Modules to Create/Update
*   **New Files in `my-nextjs-app/src/lib/integrations/offline/`:**
    *   `OfflineQueue.ts`: Implements the `OfflineQueue` class using `idb`.
    *   `syncManager.ts`: Handles reconnection events and triggers `OfflineQueue.syncQueue()`.
*   **New Supabase Edge Function (if Option A):**
    *   `supabase/functions/process-integration-action/index.ts`: Receives queued actions and processes them (e.g., by calling `connector-service`).
*   **OR New Next.js Route Handler (if Option B):**
    *   `my-nextjs-app/src/app/api/integrations/sync-offline/route.ts`: Receives queued actions from client and forwards to `connector-service`.
*   **Update UI Components:** Relevant UI components that trigger actions need to use `OfflineQueue.queueAction()` if offline.

### 2.10.4 Supabase Schema Changes
*   No new tables specifically for the queue itself (as it's client-side).
*   The `audit_logs` table would be used to log queued and synced actions.
*   If using RPC:
    ```sql
    -- In a new migration file
    CREATE OR REPLACE FUNCTION process_integration_action(tenant_id_param UUID, connector_name_param TEXT, action_payload JSONB)
    RETURNS VOID AS $$
    BEGIN
      -- Placeholder: Logic to forward this action to the connector-service
      -- This might involve an HTTP request to the connector-service,
      -- or if Supabase has direct access, calling a DB function that connector-service polls.
      -- For now, just log it.
      INSERT INTO audit_logs (tenant_id, user_id, action, payload)
      VALUES (tenant_id_param, 'system-offline-sync', 'process_integration_action_invoked', action_payload);
    END;
    $$ LANGUAGE plpgsql;
    ```

### 2.10.5 Docker/`docker-compose.yml` Changes
*   None.

### 2.10.6 Dependencies to Add
*   To `my-nextjs-app/package.json`:
    *   `idb` (for IndexedDB wrapper).

---

## 2.11 End-to-End Encryption and Secure Authentication

### 2.11.1 Component Goal
Prioritize security with encryption and robust authentication.

### 2.11.2 Integration Strategy & Key Files/Modules
*   **Encryption (AES-256 for data at rest):**
    *   **Location:** Utility functions in a shared library or within `connector-service` if primarily used there. Example path: `my-nextjs-app/connector-service/src/utils/crypto.ts`.
    *   **Key Management:** `ENCRYPTION_KEY` must be managed securely (e.g., via Vault, not hardcoded or in plaintext env vars for production). The `connector-service` `config/index.ts` would load this.
    *   **Dependencies:** Node.js `crypto` module (built-in).
*   **TLS 1.3 (Data in Transit):**
    *   **Location:** This is primarily a deployment/infrastructure concern. Ensure reverse proxies (e.g., Nginx, Traefik) and services are configured for TLS. For local dev with `docker-compose.yml`, this might involve self-signed certs or a local CA if mTLS is also implemented. The example shows command args for TLS certs.
*   **OAuth 2.0 (User/Client Authentication):**
    *   **Location:**
        *   Option A (Next.js BFF): Use `NextAuth.js` within `my-nextjs-app` for handling OAuth 2.0 flows for user authentication against third-party providers or a central auth server. This is a common Next.js pattern.
        *   Option B (Dedicated Auth Service): The example shows Passport.js in a separate Express app. This would be a new `auth-service` microservice if complex, multi-provider OAuth logic is needed beyond user login.
    *   **Strategy:** For simplicity and Next.js idiomatic integration, `NextAuth.js` is recommended for user authentication. If the OAuth mentioned is for service-to-service auth or for connectors themselves (which is handled by `connector-service`'s auth strategies), then it's different. The example seems to be for user login.
    *   **Key Files (using NextAuth.js):**
        *   `my-nextjs-app/src/app/api/auth/[...nextauth]/route.ts`: NextAuth.js configuration.
        *   Update `.env.local` with OAuth provider credentials.
    *   **Dependencies (for NextAuth.js):** `next-auth`.
*   **Vault Integration:**
    *   Already implemented for `connector-service` in Subtask 4.1.6. Extend to other services as needed.
*   **mTLS for Intra-Cluster Communication:**
    *   **Location:** Deployment configuration (e.g., Docker Compose with custom network and certs, Kubernetes with service mesh like Istio/Linkerd).
    *   This is an advanced setup, likely for later production hardening.
*   **RBAC & Least Privilege (Kubernetes):**
    *   **Location:** Kubernetes manifest files.
    *   Relevant for production deployment, not local Docker Compose setup directly.

### 2.11.3 Supabase Schema Changes
*   None directly from this section, but `audit_logs` (from 2.13) supports security auditing.

### 2.11.4 Docker/`docker-compose.yml` Changes
*   For mTLS, services would need volumes for certs and updated start commands. This is complex for local dev and might be deferred.
*   If a dedicated `auth-service` is built, it needs adding to Docker Compose.

---

## 2.12 User-Friendly Interface for Integration Management

### 2.12.1 Component Goal
Provide a React-based dashboard for managing integrations, including setup guides and marketplace access, adhering to WCAG AAA.

### 2.12.2 Integration Strategy
*   **Location:** Next.js frontend (`my-nextjs-app/src/app/(dashboard)/integrations/` for pages, and `my-nextjs-app/src/components/integrations/` for shared components).
*   **Components:**
    *   `Dashboard.tsx`: Main page for viewing/managing connected integrations.
    *   `SetupGuide.tsx`: Reusable component for guiding users through connector setup.
    *   `Marketplace.tsx`: (Covered in 2.7).
*   **Interaction:** Uses Route Handlers to communicate with `connector-service` (for managing existing integrations) and `marketplace-service` (for discovering/installing new ones).

### 2.12.3 Key Files/Modules to Create/Update
*   **New Next.js Pages/Components:**
    *   `my-nextjs-app/src/app/(dashboard)/integrations/page.tsx`: Main dashboard page.
    *   `my-nextjs-app/src/components/integrations/dashboard/IntegrationsList.tsx`
    *   `my-nextjs-app/src/components/integrations/dashboard/IntegrationCard.tsx`
    *   `my-nextjs-app/src/components/integrations/SetupGuide.tsx`
*   **Update Next.js Route Handlers:**
    *   Ensure BFF endpoints exist to support dashboard operations (list configured integrations, get status, trigger actions via `connector-service`). Many of these would map to `connector-service` endpoints.

### 2.12.4 WCAG AAA Compliance
*   Apply accessibility best practices throughout UI development (color contrast, keyboard nav, ARIA). This is an ongoing concern for all UI work.

### 2.12.5 Dependencies to Add
*   Standard React/Next.js dependencies. Consider UI libraries if not already in use (e.g., Chakra UI, Material UI, Shadcn/ui for accessible components).

---

## 2.13 Data Sovereignty & Compliance

### 2.13.1 Component Goal
Ensure data residency and provide audit trails.

### 2.13.2 Integration Strategy
*   **Data Residency:**
    *   This is primarily an infrastructure and deployment concern (Kubernetes node selectors, region-specific Supabase projects). Not directly implementable in the application code for local development beyond designing services to be stateless or configurable for different database backends.
    *   The plan should acknowledge this as a deployment strategy.
*   **Audit Trails:**
    *   **Location:** Logging to the `audit_logs` Supabase table from various services (`connector-service`, `marketplace-service`, Next.js BFF for user-initiated actions).
    *   The `audit_logs` table schema was defined in section 2.6.4. Ensure all relevant actions are logged.

### 2.13.3 Key Files/Modules to Create/Update
*   **Update various services/modules:**
    *   `my-nextjs-app/connector-service/src/core/ConnectorManager.ts` (and other relevant places): Add calls to insert into `audit_logs`.
    *   `my-nextjs-app/marketplace-service/src/routes/*.ts`: Add calls to insert into `audit_logs`.
    *   Next.js BFF Route Handlers: For user-facing actions.
*   **Utility function for audit logging (optional):**
    *   `my-nextjs-app/src/lib/auditLogger.ts` (for BFF) or similar in each microservice.

### 2.13.4 Supabase Schema Changes
*   `audit_logs` table (as defined in 2.6.4 or if a more detailed one is needed from the example).

### 2.13.5 Docker/`docker-compose.yml` Changes
*   None directly for audit trails. Regional deployment aspects are outside local Docker Compose.

---

## 2.14 Connector SDK & Plugin Framework

### 2.14.1 Component Goal
Streamline new connector development with a unified SDK and CLI.

### 2.14.2 Integration Strategy
*   **SDK Location:** This would be a new, separate NPM package, potentially developed within the `my-nextjs-app/packages/` directory if using a monorepo structure (like pnpm workspaces), or as a completely separate repository. Let's assume `my-nextjs-app/packages/connector-sdk/`.
*   **CLI Tool Location:** Also part of the new SDK package, or a related package (`my-nextjs-app/packages/connector-cli/`).
*   **Example Usage:** New connectors (like the example `crm-connector`) would be separate microservices built using this SDK.

### 2.14.3 Key Files/Modules to Create/Update
*   **New Package `my-nextjs-app/packages/connector-sdk/`:**
    *   `src/index.ts`: Exports `createConnector` and other SDK utilities.
    *   `src/monitoring.ts`: (If monitoring helpers are part of SDK).
    *   `package.json`, `tsconfig.json`.
*   **New Package `my-nextjs-app/packages/connector-cli/` (Optional, can be part of SDK):**
    *   `bin/create-connector.js`: CLI script.
    *   Templates for Dockerfile, package.json, src/index.js, k8s manifests, GitHub Actions.
*   **Example Connector (New Microservice, e.g., `my-nextjs-app/crm-connector-example/`):**
    *   Built using the SDK.

### 2.14.4 Supabase Schema Changes
*   None directly.

### 2.14.5 Docker/`docker-compose.yml` Changes
*   New example connectors built with the SDK would be added to Docker Compose if they need to run locally.

### 2.14.6 Dependencies to Add
*   To `my-nextjs-app/packages/connector-sdk/package.json`:
    *   `express`, `axios`, `prom-client` (if included).
*   To `my-nextjs-app/packages/connector-cli/package.json`:
    *   `fs-extra` (or similar for file system operations).

---

**Note on 2.15 - 2.18:** These sections (CI/CD, Performance Testing, Documentation, Accessibility) describe processes, best practices, and specific testing/documentation tools rather than distinct software components to be integrated in the same way as 2.6-2.14. They should be incorporated into the development lifecycle and relevant parts of the application (e.g., Accessibility in UI, OpenAPI for services). This plan focuses on the structural and software components.

This plan provides a high-level roadmap. Each section will require further detailed design and iterative implementation.