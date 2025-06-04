// src/components/SessionBoundary.tsx
// src/components/SessionBoundary.tsx
"use client";
import { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { useRouter, usePathname } from 'next/navigation'; // Import for redirection and path checking

const SessionBoundary = ({ children }: { children: React.ReactNode }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated' && pathname !== '/login') {
      // If unauthenticated and not already on login page, redirect to login
      // This assumes /login is a public route. A more robust solution would check against a list of public routes.
      router.push('/login?reason=no_session');
    }
  }, [status, pathname, router]);

  if (status === 'loading') {
    return <div>Authenticating...</div>; // Show loading indicator while checking session
  }

  if (status === 'unauthenticated' && pathname !== '/login') {
    // If still unauthenticated after loading and not on a public route that handles this,
    // it might be showing "Authenticating..." briefly before redirect.
    // For now, the useEffect handles redirect. If already on /login, children (login page) will render.
    return null; // Or a more specific loading/redirect indicator
  }

  return children; // Render children if session exists, or if on a public page that doesn't require session
};

export default SessionBoundary;
