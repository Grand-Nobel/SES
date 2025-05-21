'use client';
import React, { useEffect, useRef } from 'react';

export const FocusTrap: React.FC<{ children: React.ReactNode; 'data-testid'?: string }> = ({
  children,
  'data-testid': dataTestId = 'focus-trap',
}) => {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current as HTMLElement | null; // Added type assertion
    if (!root) return;

    const focusableElements = root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>; // Corrected NodeListOf type
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement; // Added type assertion
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement; // Added type assertion
    firstElement.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    root.addEventListener('keydown', handleKeyDown);
    return () => root.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    
      {children}
    
  );
};
