# Implementation Plan for SEED Outline Section 1 pt II

This plan outlines the steps to implement the components and features described in Section 1 pt II of the SEED Outline, incorporating relevant information from the Next.js documentation.

## Outline Sections to Implement:

*   **1.4.3 Color Contrast Requirements:** Color Contrast Utilities and Hook, ContrastChecker Component.
*   **1.4.4 Text Resizability Support:** Text Scaling Utilities, TextZoomStore.
*   **1.4.5 Alternative Text for Images:** Alt Text Utilities, ImageDescriptionTool.
*   **1.5 Application Layout:** Project Structure, Root Layout with Streaming SSR, Middleware, Dashboard Layout, Loading and Error Pages, Dashboard Page with Streaming SSR, Analytics Page with ISR, Notifications Page, Settings Page.
*   **1.5.2 API Routes & Edge Functions:** Validation Rules API, Edge Function for Token Validation.
*   **1.5.6 Performance & NFR Budgets:** Lighthouse CI configuration.
*   **1.5.7 PWA & Offline-First:** Service Worker, App Setup, SyncStatus, InstallPrompt.
*   **1.5.8 Internationalization & Localization:** Locale Messages.
    *   [x] Create `my-nextjs-app/locales/en/common.json` with content from the outline.
    *   [x] Create `my-nextjs-app/locales/ar/common.json` with content from the outline.
*   **1.5.9 AI-Driven Personalization UI:** ShortcutRecommender.
    *   [x] `ShortcutRecommender.tsx` was created at `src/components/ShortcutRecommender.tsx` and updated with outline content.
    *   [x] Create `my-nextjs-app/src/components/ShortcutRecommender.module.css`.
*   **1.5.10 Integration UI Connectors:** ConnectorCard, Integration API Route.
    *   [x] Create `ConnectorCard.tsx` at `my-nextjs-app/packages/ui/src/ConnectorCard/ConnectorCard.tsx`.
    *   [x] Create `ConnectorCard.module.css`.
    *   [x] Create API Route Handler for integrations: `my-nextjs-app/src/app/api/integrations/[service]/connect/route.ts`.
*   **1.5.11 Developer Handoff & Test Hooks:** API Codegen, Open API Schema.
    *   [x] Create API codegen script: `my-nextjs-app/scripts/generate-api.ts`.
    *   [x] Create OpenAPI schema: `my-nextjs-app/openapi.json`.
    *   [x] Install `openapi-typescript-codegen` if not already (likely a dev dependency).
*   **1.5.12 Security & Data Sovereignty UI:** Encrypted Storage.
    *   [x] Create Encrypted Storage utilities: `my-nextjs-app/src/lib/storage/encryptedStorage.ts`.
    *   [x] Install `idb` and `swr` if not already present.
*   **1.5.13 Error States & Edge Cases:** ErrorBoundary.

## Key Takeaways from Next.js Documentation:

*   **API Routes & Edge Functions:** Use Route Handlers (`route.js|ts`) in the `app` directory. Support for various HTTP methods, caching, CORS, and handling requests/responses.
*   **Middleware:** Use `middleware.ts` in the project root to intercept requests. Use `matcher` config or conditional statements to define paths. Can modify requests/responses, handle cookies and headers, and configure CORS.
*   **Internationalization & Localization:** Implement internationalized routing with sub-paths or domains, often using middleware for locale detection. Localization involves using dictionaries for translations, fetched on the server.
*   **PWA & Offline-First:** Build PWAs with a web app manifest (`manifest.ts`), implement web push notifications using Server Actions and a service worker (`public/sw.js`), generate VAPID keys, and ensure HTTPS.

## Implementation Steps:

1.  **Review Existing Code:** Examine the current `my-nextjs-app` codebase to identify existing components and functionalities that align with the outline.
2.  **Prioritize Implementation:** Determine the order of implementation based on dependencies and logical flow, starting with core layout and middleware, then accessibility, and so on.
3.  **Implement Components:** Create new files and write code for the missing components based on the provided snippets in the outline and the knowledge gained from the Next.js documentation.
4.  **Configure and Integrate:** Set up necessary dependencies, configure API routes, middleware, internationalization, PWA features, and other integrations as required.
5.  **Testing:** Perform basic testing to verify the functionality and integration of the implemented components.

## Completed Remaining Placeholders/TODOs:

*   [x] `Toast.tsx` component (used in `NotificationsPage.tsx`).
*   [x] `AccessibleImage.tsx` component (used in `ImageDescriptionTool.tsx`).

## Remaining Remaining Placeholders/TODOs:

*   Ensure all `@ts-ignore` comments are reviewed and resolved if possible.
*   Address any remaining TypeScript errors or module resolution issues.

This plan will serve as a guide during the implementation process.
