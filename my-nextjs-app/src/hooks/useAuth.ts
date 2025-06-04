// src/hooks/useAuth.ts
import { useSession } from 'next-auth/react';
import { Session } from 'next-auth';

export const useAuth = () => {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  // NextAuth.js handles session refreshing internally, so no explicit refreshSession is needed here.
  // The session object from useSession will automatically update.

  return { session, loading };
};
