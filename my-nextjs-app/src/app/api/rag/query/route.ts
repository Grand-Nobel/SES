import { NextResponse } from 'next/server';
import { queryRAG } from '../../../../lib/agents/ragPipeline'; // Adjusted import path

export async function POST(request: Request) {
  // TODO: Implement authentication and authorization
  // 1. Verify the user is authenticated (e.g., check session/token).
  // 2. Authorize that the authenticated user has access to the provided tenantId.
  //    This might involve looking up user-tenant associations.
  // If not authenticated or authorized, return an appropriate error response (e.g., 401 Unauthorized or 403 Forbidden).

  try {
    const { tenantId, query } = await request.json();

    if (!tenantId || !query) {
      return NextResponse.json({ error: 'Missing tenantId or query' }, { status: 400 });
    }

    const results = await queryRAG(tenantId, query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in RAG query API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to process RAG query', details: errorMessage }, { status: 500 });
  }
}
