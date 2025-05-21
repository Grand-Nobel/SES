'use client';

import { signIn, getProviders, ClientSafeProvider } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Button from '@/packages/ui/src/Button/Button'; // Assuming Button component path
import logger from '@/lib/logging'; // Using the simplified console logger for client-side

export default function SignInPage() {
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const authError = searchParams.get('error');

  useEffect(() => {
    (async () => {
      try {
        // Explicitly log critical URLs for debugging CLIENT_FETCH_ERROR
        const nextAuthUrlEnv = process.env.NEXTAUTH_URL; // This might be undefined client-side
        const nextPublicAppUrlEnv = process.env.NEXT_PUBLIC_APP_URL;
        const windowOrigin = window.location.origin;
        
        console.log('[SignInPage] Debug URLs:', {
          nextAuthUrlEnv,
          nextPublicAppUrlEnv,
          windowOrigin
        });
        logger.info('[SignInPage] Debug URLs:', { nextAuthUrlEnv, nextPublicAppUrlEnv, windowOrigin });


        logger.info('Attempting to get providers client-side.');
        const res = await getProviders();
        if (res) {
          logger.info({ providers: Object.keys(res) }, 'Successfully fetched providers.');
          setProviders(res);
        } else {
          logger.warn('getProviders() returned null or undefined.');
          setError('Could not load sign-in options. Please try refreshing.');
        }
      } catch (fetchError: any) {
        // Use console.error directly to ensure full object is logged, especially 'cause'
        console.error('[SignInPage] Error in getProviders() call. Full error object:', fetchError);
        if (fetchError.cause) {
          console.error('[SignInPage] Error cause:', fetchError.cause);
        }
        logger.error({ // Keep our structured log, but console.error above is for raw details
          message: 'Failed to fetch providers.',
          errorName: fetchError.name,
          errorMessage: fetchError.message,
          // stack: fetchError.stack, // Stack can be very long, console.error(fetchError) captures it
          cause: fetchError.cause ? JSON.stringify(fetchError.cause) : 'N/A' // Attempt to stringify cause
        }, 'Error in getProviders() call (structured log).');
        setError('Failed to load sign-in options. Check browser console for detailed error.');
      }
    })();
  }, []);

  useEffect(() => {
    if (authError) {
      switch (authError) {
        case 'CredentialsSignin':
          setError('Invalid email or password. Please try again.');
          break;
        case 'OAuthAccountNotLinked':
            setError('This email is already associated with another provider. Try signing in with that provider.');
            break;
        default:
          setError('An error occurred during sign-in. Please try again.');
      }
      logger.warn({ authError }, 'Sign-in error from NextAuth redirect.');
    }
  }, [authError]);

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    logger.info({ email }, 'Attempting credentials sign-in from custom page.');
    // Let NextAuth.js handle the redirect by removing redirect: false or setting to true
    const result = await signIn('credentials', {
      // redirect: true, // This is the default, can be omitted
      email,
      password,
      callbackUrl: callbackUrl,
    });

    // If signIn is called with redirect:true (default), it won't return here on success,
    // as the browser will be redirected by NextAuth.
    // It will only return here if there's an error and redirect is prevented.
    setIsLoading(false);
    if (result?.error) {
      logger.warn({ error: result.error, email }, 'Credentials sign-in failed on custom page.');
      // Error messages are often codes, map them to user-friendly messages
      if (result.error === 'CredentialsSignin') {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(`Sign-in failed: ${result.error}. Please try again.`);
      }
    }
    // No need for manual window.location.href if redirect is handled by NextAuth
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-800">Sign In</h1>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        {/* Credentials Form */}
        {providers?.credentials && (
          <form onSubmit={handleCredentialsSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in with Email'}
            </Button>
          </form>
        )}

        {/* OAuth Providers */}
        {providers && Object.values(providers).map((provider) => {
          if (provider.id === 'credentials') return null; // Skip credentials, handled above
          return (
            <div key={provider.name}>
              <Button
                onClick={() => {
                  setIsLoading(true);
                  signIn(provider.id, { callbackUrl });
                }}
                className="w-full"
                variant="secondary" // Changed from "outline"
                disabled={isLoading}
              >
                {isLoading ? 'Redirecting...' : `Sign in with ${provider.name}`}
              </Button>
            </div>
          );
        })}
        
        {!providers && !isLoading && <p>Loading sign-in options...</p>}
      </div>
    </div>
  );
}