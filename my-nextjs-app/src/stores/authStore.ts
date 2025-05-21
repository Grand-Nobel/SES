// my-nextjs-app/src/stores/authStore.ts
import { create, StoreApi } from 'zustand';

interface User {
  id?: string;
  tenantName: string;
  role?: string; // Added role property
}

export interface AuthState {
  tenantId: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  initialize: () => Promise<void>;
  setAuth: (auth: Partial<Pick<AuthState, 'tenantId' | 'user'>>) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
}

// Define the store type
type AuthStoreType = AuthState & AuthActions;

// Create the store
const authStore = create<AuthStoreType>((set) => ({
  tenantId: null,
  user: null,
  isLoading: true,
  error: null,
  initialize: async () => {
    set({ isLoading: true, error: null });
    console.log("AuthStore: Initializing session...");
    // Simulate initialization
    setTimeout(() => {
      set({ 
        tenantId: 'mock-tenant-id-initialized', 
        user: { id: 'mock-user-id-initialized', tenantName: 'Mock Tenant Initialized' },
        isLoading: false 
      });
      console.log("AuthStore: Mock session initialized.");
    }, 500);
  },
  setAuth: (auth) => {
    set((state) => ({ ...state, ...auth, isLoading: false, error: null }));
    console.log("AuthStore: Auth state updated", auth);
  },
  setError: (error) => set({ error }),
  clearAuth: () => {
    set({ user: null, tenantId: null, isLoading: false, error: null });
    console.log("AuthStore: Auth cleared.");
  },
}));

// Export the hook for React components
// To allow useAuthStore.initialize(), useAuthStore.getState() etc. as per SEED doc:
const exportedAuthStore = authStore as typeof authStore & AuthActions & { getState: () => AuthState & AuthActions };
exportedAuthStore.initialize = authStore.getState().initialize;
exportedAuthStore.setAuth = authStore.getState().setAuth;
exportedAuthStore.clearAuth = authStore.getState().clearAuth;
// getState is already part of the store instance from create

export { exportedAuthStore as useAuthStore };
export default exportedAuthStore; // Also provide a default export
