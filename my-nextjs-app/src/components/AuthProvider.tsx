'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

interface AuthProviderProps {
  children: ReactNode;
  // session?: any; // The session prop is optional for SessionProvider in App Router
}

export default function AuthProvider({ children }: AuthProviderProps) {
  // The SessionProvider can optionally take a `session` prop if you're passing
  // a session fetched server-side, but for client-side session management via
  // useSession, just wrapping children is often enough.
  return <SessionProvider>{children}</SessionProvider>;
}