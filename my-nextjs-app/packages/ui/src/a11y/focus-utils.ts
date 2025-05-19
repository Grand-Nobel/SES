import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore'; // Added useAuthStore import

export function createCustomTabOrder(containerId: string, selectors: string[]): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const elements = selectors
    .map((selector) => Array.from(container.querySelectorAll(selector)) as HTMLElement[])
    .flat()
    .filter(Boolean);

  elements.forEach((element, index) => {
    element.setAttribute('tabindex', '0');
    element.setAttribute('data-focus-order', String(index + 1));
    element.addEventListener('focus', async () => {
      container.setAttribute('data-current-focus', String(index + 1));
      const maskedEvent = await PrivacyLogger().maskPersonalData({ containerId, focusIndex: index + 1 });
      // Assuming useAuthStore can be accessed like this in a utility, might need adjustment
      const authStoreState = useAuthStore().getState(); 
      await supabase.from('ui_events').insert({
        tenant_id: authStoreState.tenantId,
        event: 'focus_change',
        payload: maskedEvent,
      });
    });
  });
}

export function handleArrowNavigation(
  event: KeyboardEvent,
  containerSelector: string,
  itemSelector: string,
  orientation: 'horizontal' | 'vertical' | 'grid' = 'vertical',
  gridColumns?: number
): void {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const items = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
  if (!items.length) return;

  const currentIndex = items.findIndex((item) => item === document.activeElement);
  if (currentIndex === -1) return;

  let nextIndex: number | null = null;

  if (orientation === 'horizontal') {
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % items.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + items.length) % items.length;
  } else if (orientation === 'vertical') {
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
    else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
  } else if (orientation === 'grid' && gridColumns) {
    const row = Math.floor(currentIndex / gridColumns);
    const col = currentIndex % gridColumns;
    if (event.key === 'ArrowRight' && col < gridColumns - 1) nextIndex = currentIndex + 1;
    else if (event.key === 'ArrowLeft' && col > 0) nextIndex = currentIndex - 1;
    else if (event.key === 'ArrowDown' && (row + 1) * gridColumns < items.length) {
      nextIndex = (row + 1) * gridColumns + Math.min(col, (items.length - (row + 1) * gridColumns) - 1);
    } else if (event.key === 'ArrowUp' && row > 0) nextIndex = (row - 1) * gridColumns + col;
  }

  if (nextIndex !== null && items[nextIndex]) {
    event.preventDefault();
    items[nextIndex].focus();
  }
}

export function createFocusIndicatorStyles(
  styleId: string = 'focus-styles',
  color: string = 'var(--color-focus, #0057FF)',
  width: string = '2px',
  offset: string = '2px'
): void {
  if (typeof document === 'undefined') return; // SSR guard
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) existingStyle.remove();

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    :focus {
      outline: ${width} solid ${color};
      outline-offset: ${offset};
    }
    @media (forced-colors: active) {
      :focus { outline: 3px solid CanvasText !important; }
    }
  `;
  document.head.appendChild(style);
}

export function initFocusVisiblePolyfill(): void {
  if (typeof document === 'undefined') return; // SSR guard
  let hadKeyboardEvent = false;

  const checkForKeyboardUser = async (event: Event): Promise<void> => { // Changed parameter type to Event
    hadKeyboardEvent = event.type === 'keydown';
    document.documentElement.setAttribute('data-input-modality', hadKeyboardEvent ? 'keyboard' : 'mouse');
    const maskedEvent = await PrivacyLogger().maskPersonalData({ modality: hadKeyboardEvent ? 'keyboard' : 'mouse' });
    // Assuming useAuthStore can be accessed like this in a utility, might need adjustment
    const authStoreState = useAuthStore().getState();
    await supabase.from('ui_events').insert({
      tenant_id: authStoreState.tenantId,
      event: 'input_modality_change',
      payload: maskedEvent,
    });
  };

  document.addEventListener('keydown', checkForKeyboardUser, true); // Removed type assertion
  document.addEventListener('mousedown', checkForKeyboardUser, true); // Removed type assertion
  document.addEventListener('touchstart', checkForKeyboardUser, true); // Removed type assertion

  const style = document.createElement('style');
  style.textContent = `
    :focus:not(:focus-visible) { outline: none !important; }
    .keyboard-user :focus, :focus-visible {
      outline: 2px solid var(--color-focus, #0057FF) !important;
      outline-offset: 2px !important;
    }
  `;
  document.head.appendChild(style);
}