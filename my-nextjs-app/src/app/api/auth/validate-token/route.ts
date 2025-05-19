// my-nextjs-app/src/app/api/auth/validate-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase'; // Adjusted path

export const runtime = 'edge'; // Specify edge runtime

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 });
  }

  try {
    // In Supabase, you typically verify a JWT by trying to get the user with it.
    // The `verifyToken` method mentioned in the outline might be a custom or older Supabase client method.
    // The current Supabase JS client (v2) uses `getUser(token)` for this.
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      // Log the specific error for debugging, but return a generic message to the client
      console.error('Token validation error:', error.message);
      return NextResponse.json({ error: 'Invalid token', details: error.message }, { status: 401 });
    }

    if (!user) {
      // This case might also be covered by the error above, but as an explicit check
      return NextResponse.json({ error: 'Invalid token or user not found' }, { status: 401 });
    }

    // Token is valid, return user information (or a subset)
    // Be careful about exposing sensitive user data here.
    // Only return what's necessary for the client to confirm validation.
    return NextResponse.json({ 
      message: 'Token is valid', 
      user: { id: user.id, email: user.email, aud: user.aud } // Example: return some non-sensitive user info
    }, { status: 200 });

  } catch (err) {
    console.error('Internal server error during token validation:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown internal server error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}