'use client';
import React, { useEffect, useRef } from 'react';
import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore'; // Added useAuthStore import

interface KeyboardNavigationProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical' | 'grid';
  gridColumns?: number;
  wrapNavigation?: boolean;
  className?: string;
  onNavigate?: (index: number) => void;
  'data-testid'?: string;
}

export const KeyboardNavigation: React.FC<KeyboardNavigationProps> = ({
  children,
  orientation = 'vertical',
  gridColumns = 3, // Default value from SEED doc
  wrapNavigation = true, // Default value from SEED doc
  className = '',
  onNavigate,
  'data-testid': dataTestId = 'keyboard-navigation',
}) => {
  const containerRef = useRef<HTMLDivElement>(null); // Typed containerRef
  const authStoreHook = useAuthStore(); // Call useAuthStore hook

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = Array.from(
      container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ) as HTMLElement[];

    const handleKeyDown = async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (!container.contains(target)) return;

      const currentIndex = focusableElements.findIndex((el) => el === target);
      if (currentIndex === -1) return;

      let nextIndex: number | null = null;
      if (orientation === 'horizontal') {
        if (event.key === 'ArrowRight') nextIndex = wrapNavigation ? (currentIndex + 1) % focusableElements.length : (currentIndex + 1 < focusableElements.length ? currentIndex + 1 : null);
        else if (event.key === 'ArrowLeft') nextIndex = wrapNavigation ? (currentIndex - 1 + focusableElements.length) % focusableElements.length : (currentIndex - 1 >= 0 ? currentIndex - 1 : null);
      } else if (orientation === 'vertical') {
        if (event.key === 'ArrowDown') nextIndex = wrapNavigation ? (currentIndex + 1) % focusableElements.length : (currentIndex + 1 < focusableElements.length ? currentIndex + 1 : null);
        else if (event.key === 'ArrowUp') nextIndex = wrapNavigation ? (currentIndex - 1 + focusableElements.length) % focusableElements.length : (currentIndex - 1 >= 0 ? currentIndex - 1 : null);
      } else if (orientation === 'grid') {
        const row = Math.floor(currentIndex / gridColumns);
        const col = currentIndex % gridColumns;
        if (event.key === 'ArrowRight' && col < gridColumns - 1 && currentIndex + 1 < focusableElements.length) nextIndex = currentIndex + 1;
        else if (event.key === 'ArrowLeft' && col > 0) nextIndex = currentIndex - 1;
        else if (event.key === 'ArrowDown' && (row + 1) * gridColumns + col < focusableElements.length) nextIndex = (row + 1) * gridColumns + col;
        else if (event.key === 'ArrowUp' && row > 0) nextIndex = (row - 1) * gridColumns + col;
      }

      if (nextIndex !== null && focusableElements[nextIndex]) {
        event.preventDefault();
        focusableElements[nextIndex].focus();
        onNavigate?.(nextIndex);
        const maskedEvent = await PrivacyLogger().maskPersonalData({ orientation, nextIndex });
        await supabase.from('ui_events').insert({
          tenant_id: authStoreHook.getState().tenantId, // Use authStoreHook instance
          event: 'keyboard_navigation',
          payload: maskedEvent,
        });
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [orientation, gridColumns, wrapNavigation, onNavigate, authStoreHook]); // Added authStoreHook to dependency array

  return (
    
      {children}
    
  );
};