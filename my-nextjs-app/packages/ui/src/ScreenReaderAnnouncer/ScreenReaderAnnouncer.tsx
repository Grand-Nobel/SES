'use client';
import React, { useEffect, useState } from 'react'; // Added React import for useAnnouncer
import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore'; // Added useAuthStore import

// Interface for props is not explicitly in SEED doc for the class, but good practice
// For the useAnnouncer hook, it takes an optional boolean
// The class itself doesn't take props in constructor

export class ScreenReaderAnnouncer {
  private static instance: ScreenReaderAnnouncer;
  private container: HTMLElement | null; // container can be null on server

  private constructor() {
    if (typeof document === 'undefined') {
      // Handle SSR case where document is not available
      this.container = null; // Set container to null on server
    } else {
      this.container = document.createElement('div');
      this.container.setAttribute('aria-live', 'polite');
      this.container.setAttribute('aria-atomic', 'true');
      // className 'sr-only' is common for screen-reader only elements
      // It should be defined in global CSS (e.g., from Tailwind or custom)
      this.container.className = 'sr-only announcer'; 
      this.container.style.position = 'absolute';
      this.container.style.width = '1px';
      this.container.style.height = '1px';
      this.container.style.margin = '-1px';
      this.container.style.padding = '0';
      this.container.style.overflow = 'hidden';
      this.container.style.clip = 'rect(0, 0, 0, 0)';
      this.container.style.border = '0';
      document.body.appendChild(this.container);
    }
  }

  public static getInstance(): ScreenReaderAnnouncer {
    // Return a mock instance on the server
    if (typeof window === 'undefined') {
        return {
            announce: (message: string, tenantId: string | null, assertive?: boolean) => {
                // No-op on server
                console.log(`[ScreenReaderAnnouncer - Server Mock] Announce: ${message}`);
            },
            destroy: () => {
                 // No-op on server
            }
            // Add other methods if the real instance has them and they are called on the instance
        } as ScreenReaderAnnouncer; // Cast to the class type to satisfy type checker
    }

    // Return the singleton instance on the client
    if (!ScreenReaderAnnouncer.instance) {
      ScreenReaderAnnouncer.instance = new ScreenReaderAnnouncer();
    }
    return ScreenReaderAnnouncer.instance;
  }

  public async announce(message: string, tenantId: string | null, assertive: boolean = false): Promise<void> { // Added tenantId parameter
    if (typeof document === 'undefined' || !this.container) return; // SSR guard and container check

    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    this.container.appendChild(announcer);
    
    setTimeout(async () => {
      announcer.textContent = message;
      // Access tenantId from the parameter
      const maskedEvent = await PrivacyLogger().maskPersonalData({ message, assertive });
      if (tenantId) { // Only log if tenantId is available
        await supabase.from('ui_events').insert({
          tenant_id: tenantId,
          event: 'screen_reader_announce',
          payload: maskedEvent,
        });
      }
     
      setTimeout(() => {
        if (announcer.parentNode === this.container) {
          this.container?.removeChild(announcer); // Use optional chaining
        }
      }, 3000); // Cleanup after a delay
    }, 50); // Delay to ensure screen reader picks up the change
  }

  public destroy(): void {
    if (typeof document === 'undefined' || !this.container) return; // SSR guard and container check
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}

// useAnnouncer hook from SEED document
export function useAnnouncer(assertive: boolean = false) {
  const [message, setMessage] = useState('');
  const authStoreHook = useAuthStore(); // Call useAuthStore hook

  // This effect is for the hook to announce when `message` changes.
  // However, the SEED doc's `ScreenReaderAnnouncer.announce` method is imperative.
  // The hook might be intended to be used differently, e.g., returning an `announce` function.
  // For now, sticking to the SEED doc's structure.
  // The `setMessage(text)` in `announce` function below seems redundant if this effect is used.
  // Let's assume the hook provides an `announce` function.

  const announce = async (text: string, isAssertive: boolean = assertive) => { // Allow overriding assertiveness
    // setMessage(text); // This would trigger the effect below if we had one
    const announcerInstance = ScreenReaderAnnouncer.getInstance();
    // Pass tenantId when calling announce
    await announcerInstance.announce(text, authStoreHook.tenantId, isAssertive);

    // Logging from the hook as well, or rely on class logging?
    // SEED doc has `supabase.from('ui_events').inse` (incomplete) in useAnnouncer
    // For now, assuming logging is handled by the class instance.
  };
  
  return announce; // Return the announce function
}
