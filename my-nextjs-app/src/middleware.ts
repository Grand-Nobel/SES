import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
// import { supabase } from './lib/supabase'; // Keep if Supabase session is still needed for other purposes

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log('[Middleware] Pathname:', pathname);

  const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
  const isAuthenticated = !!token;
  console.log('[Middleware] Token:', token);
  console.log('[Middleware] IsAuthenticated:', isAuthenticated);

  // If trying to access protected routes and not authenticated, redirect to sign-in
  const protectedPaths = ['/analytics', '/notifications', '/settings', '/integrations', '/marketplace']; // Temporarily removed /dashboard for testing
  const isAccessingProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  if (isAccessingProtectedPath && !isAuthenticated) {
    const loginUrl = new URL('/auth/signin', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and trying to access sign-in page, redirect to dashboard
  if (isAuthenticated && pathname.startsWith('/auth/signin')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // Tenant ID check (can remain if still relevant, ensure it runs after auth check)
  // This logic might need to be adjusted based on how tenantId is associated with the NextAuth.js session/token
  if (isAuthenticated && isAccessingProtectedPath) {
    const tenantId = request.headers.get('x-tenant-id') || token?.tenantId as string; // Example: get from token
    if (!tenantId && !pathname.startsWith('/tenant-select')) {
      // return NextResponse.redirect(new URL('/tenant-select', request.url)); // Uncomment if tenant selection is implemented
    }
  }
 
   const response = NextResponse.next();

  // Apply security headers as per 8.4.2.5 Security Headers
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';");
  response.headers.set('Strict-Transport-Security', "max-age=63072000; includeSubDomains; preload");
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Feature-Policy', "geolocation 'none'; microphone 'none'; camera 'none'; payment 'none';");
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes, though NextAuth API routes like /api/auth/... should ideally be excluded if middleware causes issues)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * We need to ensure /api/auth routes are not inadvertently blocked if they aren't handled by the matcher's negative lookahead.
     * For NextAuth.js v4, it's often safer to explicitly list protected page routes rather than using a broad matcher
     * that might interfere with /api/auth.
     */
    // '/dashboard/:path*', // Temporarily removed for testing
    '/analytics/:path*',
    '/notifications/:path*',
    '/settings/:path*',
    '/integrations/:path*', 
    '/marketplace/:path*', // Restore marketplace to protected routes
    '/auth/signin', // To redirect if already authenticated
    // '/tenant-select', // If you have this page
  ],
};
