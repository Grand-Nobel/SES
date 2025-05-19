import { NextRequest, NextResponse } from 'next/server';
import { supabase } from './lib/supabase'; // Adjusted path for supabase

export async function middleware(request: NextRequest) {
  // Attempt to get the session
  // Note: supabase.auth.getSession() might not work directly in middleware
  // as it often relies on cookies that middleware might run before or have limited access to.
  // A common pattern is to use supabase.auth.getUser(token) if a token is available,
  // or to refresh the session. For simplicity, we follow the outline's intent.
  // This might need adjustment based on Supabase's recommended middleware practices.

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    // If no session or error, redirect to login, unless already on login/auth pages
    if (!request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/auth')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // If there is a session, and the user is trying to access login, redirect to dashboard
  if (session && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // Check for tenant ID if the path requires it (e.g., dashboard, settings)
  // This check should only apply to protected routes that require a tenant context.
  const protectedPaths = ['/dashboard', '/analytics', '/notifications', '/settings'];
  const requiresTenantCheck = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  if (requiresTenantCheck && session) { // Only check for tenant if session exists and path is protected
    const tenantId = request.headers.get('x-tenant-id'); // Or get from session/cookie if stored there
    // If tenantId is expected but not found, redirect to a tenant selection page
    // This logic depends on how tenantId is managed (e.g., header, cookie, part of user session)
    if (!tenantId) {
        // Allow access if on tenant selection page itself
      if (!request.nextUrl.pathname.startsWith('/tenant-select')) {
        return NextResponse.redirect(new URL('/tenant-select', request.url));
      }
    } else {
      // Optionally, add the tenantId to the request headers if not already present
      // or if it needs to be consistently available for downstream processing.
      // const requestHeaders = new Headers(request.headers);
      // requestHeaders.set('x-resolved-tenant-id', tenantId);
      // return NextResponse.next({ request: { headers: requestHeaders } });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Other static assets like /fonts/* or /assets/*
     * Matcher needs to be carefully crafted. The one from outline was:
     * ['/dashboard/:path*', '/analytics/:path*', '/notifications/:path*', '/settings/:path*']
     * This implies middleware only runs on these specific protected routes.
     * If we want broader session checking (e.g. for all pages except public ones),
     * a negative lookahead like below is more common.
     * For now, sticking to the outline's specified paths for protection.
     */
    '/dashboard/:path*',
    '/analytics/:path*',
    '/notifications/:path*',
    '/settings/:path*',
    '/login', // Also match login to redirect if already authenticated
    // '/tenant-select' // Match tenant-select if direct access should be handled
  ],
};