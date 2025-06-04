"use client";
// src/components/AppShell.tsx
import { Suspense } from 'react';
import SessionBoundary from './SessionBoundary';
import * as Sentry from '@sentry/react';

export const AppShell = ({ children }: { children: React.ReactNode }) => (
  <Sentry.ErrorBoundary
    fallback={<div>Something went wrong. <button onClick={() => window.location.reload()}>Retry</button></div>}
    beforeCapture={(scope: Sentry.Scope) => scope.setTag('component', 'AppShell')}
  >
    <Suspense fallback={<div>Loading...</div>}>
      <SessionBoundary>{children}</SessionBoundary>
    </Suspense>
  </Sentry.ErrorBoundary>
);
