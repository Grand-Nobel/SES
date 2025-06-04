# Frontend Architecture Gaps

Based on the provided "Frontend Architecture Overview" outline and the current file system, here's a summary of the components that haven't been fully incorporated or are missing:

**1. Architectural Patterns (10.1.0)**
*   **`WebSocketProvider` (`my-nextjs-app/src/components/WebSocketProvider.tsx`)**: The file exists, but its content is a placeholder. The full WebSocket connection logic, including `subscribeToAgentActions` and related functionalities described in section 10.1.3.3, is not implemented.
*   **`useAuth` Hook (`my-nextjs-app/src/hooks/useAuth.ts`)**: The file exists, but the `refreshSession` function is a placeholder and does not include the exponential backoff logic or Sentry error logging as detailed in the `SessionBoundary` description.

**2. Technology Stack (10.1.1)**
*   **Web Application - Build System**:
    *   **ESLint Configuration (`my-nextjs-app/.eslintrc.json`)**: This file is missing. The outline specifies import restrictions using ESLint.
*   **Web Application - Animations**:
    *   **`AnimatedModal` Component (`my-nextjs-app/src/components/AnimatedModal.tsx`)**: This file is missing. The component for Framer Motion animations with motion reduction fallback is not present. The `useDeviceInfo` hook it references is also not found.
*   **Web Application - i18n**:
    *   **i18n Implementation (`my-nextjs-app/src/lib/i18n.ts`)**: The file exists, but it uses `i18next` with local JSON files, not `next-intl` with Supabase and `idb-keyval` as described in the outline.
*   **Web Application - Command Palette**:
    *   **NLP Library (`my-nextjs-app/src/lib/nlp.ts`)**: This file is missing. The client-side NLP implementation with TF.js and ONNX Runtime Web is not present.
    *   **`CommandPalette` Component (`my-nextjs-app/src/components/CommandPalette.tsx`)**: This file is missing.
*   **Mobile Application**:
    *   **FlutterFlow Scripts (`my-nextjs-app/scripts/extract_flutterflow.sh`, `my-nextjs-app/scripts/validate_ejection.sh`)**: Both scripts are missing.
    *   **FlutterFlow Decision Log (`my-nextjs-app/docs/flutterflow_decisions.md`)**: This file is missing.
    *   **Mobile Key Packages (e.g., `lib/core/providers/auth_provider.dart`, `lib/core/workmanager.dart`)**: These files were not explicitly checked, but given the absence of related mobile development scripts and documentation, it's highly probable they are also missing or incomplete.
*   **Formal Design System**:
    *   **Stylelint Configuration (`my-nextjs-app/.stylelintrc.json`)**: This file is missing.
    *   **Dart Analyzer Configuration (`analysis_options.yaml`)**: This file is missing.
    *   **Widgetbook Setup (`lib/widgetbook.dart`)**: This file is missing.
    *   **Design System Guidelines (`DESIGN_SYSTEM.md`)**: This file is missing.

**3. State Management Strategy (10.1.2)**
*   **Web Application State Architecture - Fine-Grained State**:
    *   **Jotai Atoms (`my-nextjs-app/src/stores/agentAtoms.ts`)**: This file is missing.
*   **Agent-Assisted UI State Zones**:
    *   **`shadowStateStore` (`my-nextjs-app/src/stores/shadowStateStore.ts`)**: This file is missing.
    *   **`MultiStepForm` Component (`my-nextjs-app/src/components/MultiStepForm.tsx`)**: This file is missing.

**4. API Communication Layer (10.1.3)**
*   **GraphQL Client Setup - Offline Support**:
    *   **`OfflineMutationManager` (`my-nextjs-app/src/lib/api/offlineMutationManager.ts`)**: The file exists, but its content is a simplified placeholder and does not include the full implementation with `createSyncStoragePersister`, `idb-keyval`, throttling, retry logic, storage limits, or dependency sorting.
    *   **`OfflineStatus` Component (`my-nextjs-app/src/components/OfflineStatus.tsx`)**: This file is missing.
*   **WebSocket Client Setup**:
    *   **WebSocket Implementation (`my-nextjs-app/src/lib/websocket.ts`)**: This file is missing. The outline describes a detailed implementation with CRDT-inspired merge and conflict resolution.
    *   **`ConflictResolver` Component (`my-nextjs-app/src/components/ConflictResolver.tsx`)**: This file is missing.

**5. Code Structure & Organization (10.1.4)**
*   **Web Application Structure - Agent UI Bridge**:
    *   **`AgentUIBridge` Component (`my-nextjs-app/src/components/agent/agent-ui-bridge.tsx`)**: This file is missing.
    *   **`AgentTrace` Component (`my-nextjs-app/src/components/AgentTrace.tsx`)**: This file is missing.
*   **Web Application Structure - Type Safety**:
    *   **GraphQL Schema (`my-nextjs-app/src/lib/api/agent.graphql`)**: This file is missing.
    *   **GraphQL Codegen Configuration (`my-nextjs-app/codegen.yml`)**: This file is missing.

**6. Build & Deployment Process (10.1.5)**
*   **Web Application - Development**:
    *   **Docker Compose (`my-nextjs-app/docker-compose.yml`)**: This file is missing.
    *   **Local Setup Script (`my-nextjs-app/scripts/local_setup.sh`)**: This file is missing.
*   **Web Application - Testing**:
    *   **Lighthouse CI Configuration (`my-nextjs-app/lighthouserc.js`)**: This file is missing.
*   **Web Application - Deployment**:
    *   **GitHub Actions Workflow (`my-nextjs-app/.github/workflows/deploy.yml`)**: This file is missing.

**7. Backend Integration (10.1.6)**
*   **Supabase RPCs**:
    *   **Actions API (`my-nextjs-app/src/lib/api/actions.ts`)**: This file is missing.
*   **Cron Monitoring**:
    *   **`CronStatus` Component (`my-nextjs-app/src/components/admin/CronStatus.tsx`)**: This file is missing.
*   **STT Proxy**:
    *   **STT API (`my-nextjs-app/src/lib/api/stt.ts`)**: This file is missing.
