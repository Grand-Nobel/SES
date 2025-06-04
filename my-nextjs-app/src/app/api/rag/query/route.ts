import { NextResponse } from 'next/server';
import { queryRAG } from '../../../../lib/agents/ragPipeline'; // Adjusted import path
import logger from '../../../../lib/logging'; // Import the enhanced logger

export async function POST(request: Request) {
  // TODO: Implement authentication and authorization
  // 1. Verify the user is authenticated (e.g., check session/token).
  // 2. Authorize that the authenticated user has access to the provided tenantId.
  //    This might involve looking up user-tenant associations.
  // If not authenticated or authorized, return an appropriate error response (e.g., 401 Unauthorized or 403 Forbidden).

  const requestLogger = logger.withContext({ service: 'rag-api', apiRoute: '/api/rag/query' });

  try {
    const { tenantId, query } = await request.json();

    requestLogger.info({ tenantId, query }, 'Received RAG query request');

    if (!tenantId || !query) {
      requestLogger.warn({ tenantId, query }, 'Missing tenantId or query in RAG request');
      return NextResponse.json({ error: 'Missing tenantId or query' }, { status: 400 });
    }

    const results = await queryRAG(tenantId, query);
    requestLogger.info({ tenantId, query, results: 'success' }, 'Successfully processed RAG query');
    return NextResponse.json({ results });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    requestLogger.error({ error: errorMessage }, 'Error in RAG query API route');
    return NextResponse.json({ error: 'Failed to process RAG query', details: errorMessage }, { status: 500 });
  }
}
