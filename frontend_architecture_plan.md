# Frontend Architecture Implementation Plan

## 10.1.0 Architectural Patterns
### 10.1.0.1 AppShell & SessionBoundary Implementation

## 10.1.1 Technology Stack
### 10.1.1.1 Web Application Setup
### 10.1.1.2 Mobile Application Setup
### 10.1.1.3 Formal Design System Implementation

## 10.1.2 State Management Strategy
### 10.1.2.1 Web Application State Architecture Implementation
### 10.1.2.2 Mobile Application State Architecture Implementation
### 10.1.2.3 State Management Guidelines Documentation
### 10.1.2.4 Agent-Assisted UI State Zones Implementation

## 10.1.3 API Communication Layer
### 10.1.3.1 GraphQL Client Setup
### 10.1.3.2 gRPC Client Setup
### 10.1.3.3 WebSocket Client Setup

## 10.1.4 Code Structure & Organization
### 10.1.4.1 Web Application Structure Setup
### 10.1.4.2 Mobile Application Structure Setup
### 10.1.4.3 Component Organization Principles Documentation

## 10.1.5 Build & Deployment Process
### 10.1.5.1 Web Application Build & Deployment Setup
### 10.1.5.2 Mobile Application Build & Deployment Setup

## 10.1.6 Backend Integration
### 10.1.6.1 Supabase RPCs Integration
### 10.1.6.2 Database Tables Creation
### 10.1.6.3 Cron Monitoring Integration
### 10.1.6.4 STT Proxy Integration
### 10.1.0.1 AppShell & SessionBoundary Implementation

**Objective**: Implement the AppShell and SessionBoundary patterns for robust application initialization, authentication, and session management across web and mobile platforms.

**Tasks**:

*   **Web (Next.js)**:
    *   Create `src/components/AppShell.tsx` with Sentry ErrorBoundary and Suspense.
    *   Create `src/components/SessionBoundary.tsx` to handle authentication state, session refresh, route protection, and multi-tab synchronization using `localStorage` events and Supabase `onAuthStateChange`. Implement exponential backoff for refresh retries and Sentry logging.
    *   Create `src/components/WebSocketProvider.tsx` (content not provided, but implied by `app/layout.tsx`).
    *   Update `src/app/layout.tsx` to integrate `AppShell` and dynamically import `WebSocketProvider`.
    *   Ensure `lib/supabase.ts` and `hooks/useAuth.ts` are available or create placeholder files for them.
*   **Mobile (Flutter)**:
    *   Implement `app/app_widget.dart` to serve as the AppShell, initializing providers (state, API clients, theme) and establishing WebSocket connections.
    *   Integrate session management and authentication state handling within the mobile AppShell, mirroring the SessionBoundary logic.

**Dependencies**:
*   `@sentry/react` for error tracking.
*   `next/dynamic` for dynamic imports.
*   `supabase-js` for authentication and real-time features.
*   `react` for Suspense and `useEffect`.
*   `lodash.debounce` for debouncing.
*   `crypto` for `createHash` (Node.js built-in, consider browser-compatible alternative if needed for client-side).
*   `yjs` for CRDT-inspired merging.
*   `idb-keyval` for IndexedDB caching.
*   `@tanstack/query-persist-client` for persisting queries.
*   `@tanstack/react-query` for server state management.
*   `zustand` for global client state.
*   `jotai` for fine-grained UI state.
*   `react-hook-form` and `zod` for forms.
*   `framer-motion` for animations.
*   `date-fns` for date utilities.
*   `next-intl` for i18n.
*   `@tensorflow/tfjs` and `onnxjs` for client-side NLP.
*   `flutter_secure_storage` for sensitive data storage.
*   `workmanager` for background tasks.
*   `go_router` for navigation.
*   `dio` and `graphql_flutter` for network.
*   `hive` for offline queueing.
*   `riverpod` for state management.

**Acceptance Criteria**:
*   Web application loads with AppShell and SessionBoundary active.
*   Authentication state changes are handled correctly, including session refresh and logout redirects.
*   Multi-tab session synchronization works as expected.
*   Error tracking is integrated for AppShell and SessionBoundary.
*   Mobile application initializes core providers and handles authentication.
### 10.1.1.1 Web Application Setup

**Objective**: Establish the core technology stack for the web application, including framework, language, build system, and essential libraries.

**Tasks**:

*   **Framework**: Confirm Next.js 14 (App Router) setup.
*   **Language**: Ensure TypeScript (strict mode) is configured.
*   **Build System**:
    *   Configure Turborepo with Nx for dependency graph, boundary enforcement, and incremental builds.
    *   Set up Changesets for versioning.
    *   Configure ESLint for import restrictions (e.g., `no-restricted-imports` for UI packages not importing domain logic).
    *   Document evaluation criteria for Bazel.
*   **Core Libraries**:
    *   **UI**: Integrate Tailwind CSS + Radix UI/Headless UI. Configure `stylelint` with `stylelint-config-tailwindcss`.
    *   **State Management**:
        *   Set up TanStack Query v5 for server state (staleTime: 30s, 5m for reference data).
        *   Configure Zustand v4 for global client state.
        *   Integrate Jotai for fine-grained agent-driven UI state, with profiling considerations.
    *   **Forms**: Implement React Hook Form with Zod validation.
    *   **Animations**: Integrate Framer Motion for complex transitions, with CSS fallbacks and performance budgets. Create `src/components/AnimatedModal.tsx`. Ensure `hooks/useDeviceInfo.ts` is available or create a placeholder.
    *   **Dates**: Integrate date-fns.
    *   **i18n**: Set up next-intl with translations from Supabase, cached in `idb-keyval`. Create `src/lib/i18n.ts`.
    *   **Offline Support**: Configure react-query-persist-client with IndexedDB (`idb-keyval`) for caching and mutation queueing. Define throttling and storage limits.
    *   **Command Palette**: Implement client-side NLP with TF.js and ONNX Runtime Web, with fallback to server-side RPC. Create `src/lib/nlp.ts` and `src/components/CommandPalette.tsx`.

**Acceptance Criteria**:
*   Next.js application is runnable.
*   TypeScript compilation is successful with strict mode.
*   Nx and Turborepo configurations are in place and functional.
*   ESLint and stylelint enforce coding standards.
*   All core libraries are integrated and basic usage examples are functional.
*   Offline support and i18n are demonstrably working.
*   Client-side NLP for command palette is integrated with server fallback.

### 10.1.1.2 Mobile Application Setup

**Objective**: Establish the core technology stack for the mobile application, including framework, language, and key packages.

**Tasks**:

*   **Framework**: Confirm Flutter 3.19+ setup.
*   **Dart**: Ensure Dart 3.0+ is configured.
*   **Approach**: Document shared Dart packages for logic and Flutter for UI. Define FlutterFlow usage and ejection strategy. Create `scripts/extract_flutterflow.sh`, `scripts/validate_ejection.sh`, and `docs/flutterflow_decisions.md`.
*   **Key Packages**:
    *   **State**: Integrate Riverpod for global and scoped state. Create `lib/core/providers/auth_provider.dart`.
    *   **Navigation**: Integrate go_router.
    *   **Network**: Integrate dio and graphql_flutter.
    *   **Storage**: Integrate hive for offline queueing and flutter_secure_storage for sensitive data with token rotation.
    *   **Background Tasks**: Integrate Workmanager for token refresh and admin notifications. Create `lib/core/workmanager.dart`.

**Acceptance Criteria**:
*   Flutter application is runnable.
*   Dart analysis passes without errors.
*   FlutterFlow ejection scripts are functional.
*   All key packages are integrated and basic usage examples are functional.
*   Token rotation and background tasks are demonstrably working.

### 10.1.1.3 Formal Design System Implementation

**Objective**: Implement and enforce a formal design system across web and mobile platforms, ensuring consistency and adherence to design guidelines.

**Tasks**:

*   **Foundation**: Define shared design tokens.
*   **Scope**: Document tokens, components, and composites.
*   **Enforcement**:
    *   **Web**: Configure `stylelint` with `stylelint-config-tailwindcss` and custom rules for token usage. Create `.stylelintrc.json`.
    *   **Mobile**: Configure `dartanalyzer` with custom lint rules to enforce design system widgets. Create `analysis_options.yaml`.
*   **Documentation**: Set up Storybook (web) and widgetbook (mobile). Create `lib/widgetbook.dart`.
*   **Guidelines**: Document platform-specific interaction patterns and token mapping in `DESIGN_SYSTEM.md`.

**Acceptance Criteria**:
*   Design tokens are defined and accessible.
*   Web and mobile applications use design system components.
*   Linting rules enforce design system adherence.
*   Storybook and widgetbook are set up and populated with components.
*   `DESIGN_SYSTEM.md` is comprehensive and up-to-date.
### 10.1.2.1 Web Application State Architecture Implementation

**Objective**: Implement the state management architecture for the web application, distinguishing between server, global client, and fine-grained UI states.

**Tasks**:

*   **Server State**: Configure TanStack Query for server data, including `staleTime` and optimistic updates.
*   **Global Client State**: Implement Zustand stores, organized by domain (e.g., `AuthStore`, `UIStore`, `NotificationStore`).
*   **Fine-Grained State**: Integrate Jotai for agent-driven UI components to minimize re-renders. Create `src/store/agentAtoms.ts`.

**Acceptance Criteria**:
*   Server data is fetched and cached using TanStack Query.
*   Global client state is managed effectively with Zustand.
*   Jotai atoms are used for localized, agent-driven UI state.
*   State updates are performant, especially for fine-grained UI state.

### 10.1.2.2 Mobile Application State Architecture Implementation

**Objective**: Implement the state management architecture for the mobile application, utilizing Riverpod across different layers.

**Tasks**:

*   **Layers**: Define and implement state management across Application, Screen, and Widget layers using Riverpod.
*   **Providers**: Organize Riverpod providers by domain (e.g., Service, Repository, StateNotifier). Create `lib/features/leads/presentation/custom/leads_screen.dart` and `lib/features/leads/presentation/providers/leads_provider.dart` (placeholder).

**Acceptance Criteria**:
*   Riverpod is correctly set up for global, scoped, and widget-level state.
*   State is organized logically by domain.
*   Data flows correctly through the defined layers.

### 10.1.2.3 State Management Guidelines Documentation

**Objective**: Document clear guidelines for choosing the appropriate state management solution based on data characteristics.

**Tasks**:

*   **Criteria**: Detail the criteria for using TanStack Query/Repository + StateNotifier (server data), Zustand/Global Riverpod (global UI/session), Jotai/Scoped Riverpod (complex local), and useState/StatefulWidget (simple local).
*   **Principle**: Emphasize the principle of preferring local state and minimizing global client state.

**Acceptance Criteria**:
*   Guidelines are clearly documented in `frontend_architecture_plan.md`.
*   The documentation provides actionable advice for state management decisions.

### 10.1.2.4 Agent-Assisted UI State Zones Implementation

**Objective**: Implement the mechanism for AI agents to trigger client-side state changes and manage conflicts.

**Tasks**:

*   **Concept**: Implement `shadowStateStore` to manage agent-driven actions, including pausing during high user activity and conflict resolution. Create `src/store/shadowStateStore.ts`.
*   **Implementation**: Integrate `shadowStateStore` with UI components (e.g., `MultiStepForm`). Create `src/components/MultiStepForm.tsx`.
*   **UI Mutation Feedback Protocol (UMFP)**: Implement `generateProofOfAction` and `verifyAgentAction` for validating actions with cryptographic proof and TTL. Integrate with WebSocket client. Update `src/lib/websocket.ts`.

**Acceptance Criteria**:
*   Agent-driven UI actions are queued and processed by `shadowStateStore`.
*   Conflict resolution logic is correctly applied based on confidence scores.
*   UMFP ensures the integrity and timeliness of agent actions.
*   UI components react appropriately to agent-driven state changes.
### 10.1.3.1 GraphQL Client Setup

**Objective**: Configure GraphQL clients for web and mobile applications, including caching, optimistic updates, and robust offline support.

**Tasks**:

*   **Client**: Set up Apollo Client 3.8+ for web and `graphql_flutter` for mobile.
*   **Configuration**: Configure normalized cache, type policies, optimistic responses, and retry logic for both clients.
*   **Offline Support**:
    *   Integrate `react-query-persist-client` with IndexedDB (`idb-keyval`) for web.
    *   Implement `OfflineMutationManager` for mutation queueing with priority, batching, and dependency sorting. Create `src/lib/api/offlineMutationManager.ts`.
    *   Implement UI feedback for offline status and sync progress. Create `src/components/OfflineStatus.tsx`.

**Acceptance Criteria**:
*   GraphQL queries and mutations are functional on both platforms.
*   Caching and optimistic updates are correctly applied.
*   Offline mutations are queued, processed, and synchronized upon reconnection.
*   UI provides clear feedback on online/offline status and sync progress.

### 10.1.3.2 gRPC Client Setup

**Objective**: Implement gRPC clients for web and mobile applications for efficient, high-performance communication.

**Tasks**:

*   **Implementation**: Set up gRPC-Web with Envoy proxy for web and `grpc` Dart for mobile.
*   **Configuration**: Configure TLS, exponential backoff, and Protobuf schemas via Buf.

**Acceptance Criteria**:
*   gRPC communication is established and functional on both platforms.
*   Secure connections (TLS) are enforced.
*   Error handling with exponential backoff is implemented.

### 10.1.3.3 WebSocket Client Setup

**Objective**: Integrate WebSocket communication for real-time updates, including authentication, auto-reconnection, and conflict resolution.

**Tasks**:

*   **Integration**: Set up Supabase Realtime with authenticated connections, auto-reconnection, and polling fallback.
*   **Subscriptions**: Implement tenant/user/role-scoped channels and agent-specific channels.
*   **Conflict Resolution**: Implement CRDT-inspired merge with Yjs for critical data and Last-Write-Wins (LWW) for non-critical data. Implement a manual resolution UI. Update `src/lib/websocket.ts` and create `src/components/ConflictResolver.tsx`.

**Acceptance Criteria**:
*   Real-time updates are received and processed correctly.
*   Authenticated WebSocket connections are maintained.
*   Conflict resolution mechanisms (CRDT, LWW, manual UI) are functional.
*   Agent-specific channels are correctly subscribed to.
### 10.1.4.1 Web Application Structure Setup

**Objective**: Establish the defined directory and file structure for the web application to ensure maintainability and scalability.

**Tasks**:

*   **Directory Structure**: Create the following directories:
    *   `src/app/(auth)/dashboard/`
    *   `src/app/(auth)/leads/`
    *   `src/app/(auth)/calendar/`
    *   `src/app/(auth)/settings/`
    *   `src/app/(public)/login/`
    *   `src/app/(public)/signup/`
    *   `src/app/api/webhook/`
    *   `src/app/api/health/`
    *   `src/components/ui/`
    *   `src/components/layout/`
    *   `src/components/domain/`
    *   `src/components/agent/`
    *   `src/components/shared/`
    *   `src/hooks/`
    *   `src/lib/api/`
    *   `src/lib/permissions.ts`
    *   `src/store/`
    *   `src/styles/`
    *   `src/types/`
*   **Core Files**: Create placeholder files for the following:
    *   `src/app/(auth)/layout.tsx`
    *   `src/app/(public)/layout.tsx`
    *   `src/app/layout.tsx`
    *   `src/app/global-error.tsx`
    *   `src/components/agent/agent-ui-bridge.tsx`
    *   `src/components/AgentTrace.tsx`
    *   `src/hooks/useAuth.ts`
    *   `src/hooks/usePermissions.ts`
    *   `src/store/shadowStateStore.ts`
    *   `src/store/agentAtoms.ts`
    *   `src/types/permissions.ts`
    *   `src/types/agent.ts`
*   **Agent UI Bridge**: Implement `AgentUIBridge` with `React.memo`, adaptive prompts, and debug overlay. Ensure `hooks/useWindowSize.ts` is available or create a placeholder.
*   **AgentTrace**: Implement `AgentTrace` panel for action chain debugging.
*   **Type Safety**: Configure GraphQL Codegen to generate `AgentUIAction` types from `src/lib/api/agent.graphql`. Create `src/lib/api/agent.graphql` and `codegen.yml`.

**Acceptance Criteria**:
*   All specified directories and placeholder files are created.
*   The web application adheres to the defined folder structure.
*   `AgentUIBridge` and `AgentTrace` components are implemented and functional.
*   GraphQL Codegen successfully generates `AgentUIAction` types.

### 10.1.4.2 Mobile Application Structure Setup

**Objective**: Establish the defined directory and file structure for the mobile application.

**Tasks**:

*   **Directory Structure**: Create the following directories:
    *   `lib/app/router/`
    *   `lib/app/theme/`
    *   `lib/core/api/`
    *   `lib/core/providers/`
    *   `lib/core/widgets/`
    *   `lib/core/widgets/agent/`
    *   `lib/core/permissions/`
    *   `lib/features/leads/`
    *   `lib/generated/`
*   **Core Files**: Create placeholder files for the following:
    *   `lib/main.dart`
    *   `lib/app/app_widget.dart`

**Acceptance Criteria**:
*   All specified directories and placeholder files are created.
*   The mobile application adheres to the defined folder structure.

### 10.1.4.3 Component Organization Principles Documentation

**Objective**: Document the component organization principles to guide development and ensure consistency.

**Tasks**:

*   **Atomic Design**: Document the application of Atomic Design principles (Atoms, Molecules, Organisms, Templates, Pages).
*   **Patterns**: Document common component patterns (Controlled/Uncontrolled, Container/Presenter, Compound Components).

**Acceptance Criteria**:
*   Component organization principles are clearly documented in `frontend_architecture_plan.md`.
*   The documentation provides clear guidance for component development.
### 10.1.5.1 Web Application Build & Deployment Setup

**Objective**: Establish a robust build and deployment process for the web application, ensuring efficient development, testing, and production releases.

**Tasks**:

*   **Development**:
    *   Configure Next.js dev server.
    *   Set up Docker Compose for local development with production-like networking using Telepresence. Create `docker-compose.yml` and `scripts/local_setup.sh`.
*   **Build**:
    *   Define `next build` process.
    *   Integrate `tsc --noEmit` for type checking.
    *   Configure ESLint and Prettier for code quality.
*   **Testing**:
    *   Set up Jest + React Testing Library (RTL) for unit/integration tests.
    *   Integrate Cypress for end-to-end tests.
    *   Configure Lighthouse for performance auditing. Create `lighthouserc.js`.
    *   Integrate Axe-core for accessibility testing.
    *   Implement Visual Regression Testing.
*   **Containerization**: Create a multi-stage Dockerfile for the web application.
*   **Deployment**:
    *   Document deployment strategies (Vercel/AWS Amplify/Kubernetes).
    *   Implement blue/green deployment strategies.
    *   Set up automated rollback.
    *   Create GitHub Actions workflow for deployment to Kubernetes. Create `.github/workflows/deploy.yml`.
*   **Performance Budgets**: Document and enforce performance budgets for TTI, FCP, and CLS.

**Acceptance Criteria**:
*   Local development environment is easily set up and functional.
*   Build process is automated and includes type checking and linting.
*   Comprehensive test suite (unit, integration, E2E, performance, accessibility, visual regression) is integrated and passing.
*   Docker image is built correctly.
*   Automated deployment to a staging environment is successful with blue/green strategy.
*   Performance metrics meet defined budgets.

### 10.1.5.2 Mobile Application Build & Deployment Setup

**Objective**: Establish a robust build and deployment process for the mobile application, including development, testing, and distribution.

**Tasks**:

*   **Development**: Document `flutter run` for local development.
*   **Build**:
    *   Define `flutter analyze` for static analysis.
    *   Configure `flutter test` for unit/widget/integration tests.
    *   Automate platform-specific builds (Android, iOS).
*   **Deployment**:
    *   Document deployment to Google Play and App Store.
    *   Set up Firebase App Distribution for internal testing and A/B testing.
*   **A/B Testing**: Define A/B testing strategy, including variant distribution, metric tracking, and staged releases.

**Acceptance Criteria**:
*   Mobile application builds successfully for target platforms.
*   Automated tests run and pass.
*   Application can be distributed via Firebase App Distribution.
*   A/B testing framework is in place and configurable.
### 10.1.6.1 Supabase RPCs Integration

**Objective**: Integrate frontend applications with Supabase Remote Procedure Calls (RPCs) for specific backend functionalities.

**Tasks**:

*   **rotate_token**: Implement calls to `supabase.rpc('rotate_token')` for token rotation with input sanitization.
*   **notify_admin**, **suggest_role_change**: Implement calls to `supabase.rpc('notify_admin')` and `supabase.rpc('suggest_role_change')`. Ensure logging to `workmanager_alerts` and `role_errors` tables.
*   **execute_action**, **undo_action**: Implement calls to `supabase.rpc('execute_action')` and `supabase.rpc('undo_action')` with `SERIALIZABLE` isolation for transactional integrity. Create `src/lib/api/actions.ts`.

**Acceptance Criteria**:
*   All specified Supabase RPCs are callable from the frontend.
*   Token rotation is functional and secure.
*   Admin notifications and role change suggestions are logged correctly.
*   Action execution and undo operations maintain transactional integrity.

### 10.1.6.2 Database Tables Creation

**Objective**: Ensure necessary database tables for backend integration are defined and created.

**Tasks**:

*   **workmanager_alerts**: Define and create the `workmanager_alerts` table schema.
*   **role_errors**: Define and create the `role_errors` table schema.

**Acceptance Criteria**:
*   `workmanager_alerts` and `role_errors` tables exist in the database with the correct schema.

### 10.1.6.3 Cron Monitoring Integration

**Objective**: Display cron job status in the admin dashboard by integrating with backend cron job details.

**Tasks**:

*   **Integration**: Implement a frontend component to fetch and display cron job status from `cron.job_run_details`. Create `src/components/admin/CronStatus.tsx`.

**Acceptance Criteria**:
*   Admin dashboard successfully displays the status of cron jobs.
*   Data is fetched from `cron.job_run_details` table.

### 10.1.6.4 STT Proxy Integration

**Objective**: Securely handle Speech-to-Text (STT) transcription via a backend proxy.

**Tasks**:

*   **Implementation**: Implement a frontend function to send audio blobs to the `/stt-proxy` endpoint. Create `src/lib/api/stt.ts`.
*   **Security**: Ensure `GOOGLE_CLOUD_API_KEY` is securely handled on the backend via the proxy.

**Acceptance Criteria**:
*   Audio transcription via the STT proxy is functional.
*   API key is not exposed on the frontend.