// my-nextjs-app/src/stores/themeStore.ts
import { create, StoreApi, UseBoundStore } from 'zustand'; // Changed to named import

interface ThemeState {
  primaryColor: string;
  typography: { primary: string };
  error: string | null;
  // Assuming initialize might fetch theme settings
  initialize: (tenantId: string) => Promise<void>; 
  setTheme: (theme: Partial<Omit<ThemeState, 'initialize' | 'error'>>) => void;
  setError: (error: string | null) => void;
}

let storeState = {
  primaryColor: '#0057FF', // Default primary color
  typography: { primary: 'Roboto' }, // Default typography
  error: null as string | null, // Explicitly type null
};

export const useThemeStore = create<ThemeState>((set: (partial: Partial<ThemeState> | ((state: ThemeState) => Partial<ThemeState>)) => void, get: () => ThemeState) => ({
  ...storeState,
  initialize: async (tenantId: string) => {
    console.log(`Mock themeStore initialize called for tenant: ${tenantId}`);
    // In a real app, you might fetch tenant-specific theme here
    // For now, it does nothing beyond logging.
    // Example:
    // try {
    //   const themeSettings = await fetchThemeForTenant(tenantId);
    //   set({ primaryColor: themeSettings.primaryColor, typography: themeSettings.typography, error: null });
    // } catch (e) {
    //   set({ error: "Failed to load theme" });
    // }
    return Promise.resolve();
  },
  setTheme: (themeUpdate: Partial<Omit<ThemeState, 'initialize' | 'error'>>) => {
    storeState = { ...storeState, ...themeUpdate, error: null };
    set(storeState);
    console.log("Mock themeStore setTheme called with:", themeUpdate);
  },
  setError: (error: string | null) => {
    storeState = { ...storeState, error };
    set({ error });
  },
  // No explicit getState needed here if all interactions are through the hook's return values
  // However, if direct state access is needed like in authStore:
  // getState: () => get(), 
}));

// Example of how it might be used:
// const { primaryColor, initialize, setTheme } = useThemeStore();
// useEffect(() => { initialize('some-tenant-id'); }, [initialize]);
// setTheme({ primaryColor: '#FF0000' });
