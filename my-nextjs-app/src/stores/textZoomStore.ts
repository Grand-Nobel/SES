import { create } from 'zustand'; // StateCreator, supabase, PrivacyLogger, set, tenantId are unused
// import { supabase } from '@/lib/supabase'; // supabase is unused
// import { PrivacyLogger } from '@/lib/logging'; // PrivacyLogger is unused
// Corrected relative path assuming standard project structure where src and packages are siblings
// import { observeTextZoom } from '../../packages/ui/src/a11y/text-scaling'; // Commented out as function is missing

interface TextZoomState {
  zoomLevel: number;
  isZoomed: boolean;
  isHighZoom: boolean;
  initialize: (_tenantId: string) => () => void; // Return type for cleanup, _tenantId is unused
  // No explicit set method needed here if initialize handles all updates
}

export const useTextZoomStore = create<TextZoomState>((/*set*/) => ({ // set is unused
  zoomLevel: 1,
  isZoomed: false,
  isHighZoom: false,
  initialize: (_tenantId: string) => { // _tenantId is unused
    // Ensure this runs only in the browser
    // Ensure this runs only in the browser
    if (typeof window === 'undefined') {
      console.warn('TextZoomStore initialize called on the server. Text zoom observation is browser-only.');
      return () => {}; // Return a no-op cleanup function
    }

    console.warn('observeTextZoom is not available. Text zoom observation is disabled.');
    // const callback = async (zoom: number) => {
    //   set({ zoomLevel: zoom, isZoomed: zoom > 1.1, isHighZoom: zoom > 1.5 });
    //   try {
    //     const maskedEvent = await PrivacyLogger().maskPersonalData({ zoomLevel: zoom });
    //     // @ts-ignore
    //     await supabase.from('system_metrics').insert({
    //       tenant_id: tenantId,
    //       metric: 'text_zoom',
    //       value: maskedEvent, // Ensure 'value' can accept an object or stringified object
    //     });
    //   } catch (error) {
    //     console.error("Failed to log text_zoom metric:", error);
    //   }
    // };
    
    // // observeTextZoom is async and returns a promise that resolves to the cleanup function
    // // We need to handle this correctly if initialize itself is not async.
    // // For simplicity, assuming observeTextZoom is called and its cleanup is returned.
    // // If observeTextZoom itself needs to be awaited, initialize should be async.
    // // However, Zustand's create function expects synchronous return for the store object.
    // // So, the observation setup should be handled carefully.
    
    // let cleanupFunction: (() => void) | null = null;
    
    // observeTextZoom(callback).then((cleanup: () => void) => {
    //     cleanupFunction = cleanup;
    // }).catch((error: unknown) => {
    //     console.error("Failed to initialize text zoom observation:", error);
    // });

    // // Return a cleanup function that will be called if the store is ever destroyed
    // // or if the component using this part of the store unmounts (if used in a React context).
    // // For a global store, this cleanup might be tied to application lifecycle.
    // return () => {
    //   if (cleanupFunction) {
    //     cleanupFunction();
    //   }
    // };
    return () => {}; // Return a no-op cleanup function as observeTextZoom is missing
  },
}));

// Optional: A way to trigger initialization from your application's entry point or a root component
export const initializeGlobalTextZoomObserver = (tenantId: string) => {
  if (typeof window !== 'undefined') {
    return useTextZoomStore.getState().initialize(tenantId);
  }
  return () => {};
};
