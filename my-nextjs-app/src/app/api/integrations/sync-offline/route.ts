import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logging';

// This endpoint receives a single queued action from the client's syncManager
// and forwards it to the appropriate internal service.

interface OfflineActionPayload {
  // Structure should match what syncManager sends, derived from QueuedAction
  originalEndpoint: string; // The actual target microservice endpoint (e.g., /api/v1/connectors)
  originalMethod: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  originalPayload: any;
  tenantId: string; // Crucial for routing and context in microservices
  // Potentially other metadata like actionType, originalActionId for logging
}

// Define known service base URLs - these should come from env config in a real app
const CONNECTOR_SERVICE_URL = process.env.CONNECTOR_SERVICE_INTERNAL_URL || 'http://localhost:3001'; // Internal URL for connector-service
const MARKETPLACE_SERVICE_URL = process.env.MARKETPLACE_SERVICE_INTERNAL_URL || 'http://localhost:3005'; // Internal URL for marketplace-service

async function forwardRequest(action: OfflineActionPayload): Promise<NextResponse> {
  let targetBaseUrl: string;

  // Basic routing logic based on the original endpoint path.
  // This needs to be robust and align with your microservice API structure.
  if (action.originalEndpoint.startsWith('/api/v1/connectors') || action.originalEndpoint.startsWith('/api/v1/configurations')) {
    targetBaseUrl = CONNECTOR_SERVICE_URL;
  } else if (action.originalEndpoint.startsWith('/api/v1/marketplace') || action.originalEndpoint.startsWith('/api/v1/recommendations')) {
    targetBaseUrl = MARKETPLACE_SERVICE_URL;
  } else {
    logger.error({ action }, 'Unknown originalEndpoint for offline action forwarding.');
    return NextResponse.json({ error: 'Invalid action endpoint for forwarding.' }, { status: 400 });
  }

  const fullTargetUrl = `${targetBaseUrl}${action.originalEndpoint}`;
  logger.info({ ...action, fullTargetUrl }, 'Forwarding offline action to internal service.');

  try {
    const response = await fetch(fullTargetUrl, {
      method: action.originalMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': action.tenantId,
        // Add any other required internal headers, e.g., an internal auth token/API key
        // 'X-Internal-Auth': process.env.INTERNAL_SERVICE_AUTH_KEY || '',
      },
      body: JSON.stringify(action.originalPayload),
    });

    const responseData = await response.text(); // Read as text first to handle non-JSON responses
    
    // Try to parse as JSON, but don't fail if it's not (e.g. 204 No Content)
    let jsonData;
    try {
        jsonData = responseData ? JSON.parse(responseData) : null;
    } catch (e) {
        jsonData = responseData; // Keep as text if not JSON
    }

    if (!response.ok) {
      logger.error({ action, status: response.status, response: jsonData }, 'Forwarded offline action failed at target service.');
      return NextResponse.json({ error: 'Forwarded action failed.', details: jsonData }, { status: response.status });
    }

    logger.info({ action, status: response.status }, 'Forwarded offline action processed successfully by target service.');
    // Return the response from the target service, ensuring correct status code
    return NextResponse.json(jsonData, { status: response.status });

  } catch (error: any) {
    logger.error({ action, error: error.message, stack: error.stack }, 'Network or unexpected error forwarding offline action.');
    return NextResponse.json({ error: 'Error forwarding action to internal service.' }, { status: 503 }); // Service Unavailable
  }
}


export async function POST(request: NextRequest) {
  const tenantId = request.headers.get('X-Tenant-ID'); // Should match the tenantId in the action payload

  if (!tenantId) {
    // This check might be redundant if X-Tenant-ID is already enforced by middleware for all API routes
    logger.warn('Offline sync forwarding request missing X-Tenant-ID header');
    // return NextResponse.json({ error: 'Tenant ID is required in header' }, { status: 400 });
  }
  
  let actionPayload: OfflineActionPayload;
  try {
    actionPayload = await request.json();
    if (tenantId && actionPayload.tenantId !== tenantId) {
        logger.warn({ headerTenantId: tenantId, payloadTenantId: actionPayload.tenantId }, "Tenant ID mismatch in offline sync request header and payload.");
        // Decide on policy: reject, or prefer one? For now, log and proceed with payload's tenantId.
    }
  } catch (error) {
    logger.warn({ error }, 'Invalid JSON in offline sync forwarding request body');
    return NextResponse.json({ error: 'Invalid request body: Must be valid JSON.' }, { status: 400 });
  }

  if (!actionPayload.originalEndpoint || !actionPayload.originalMethod || !actionPayload.tenantId) {
    logger.warn({ payload: actionPayload }, 'Offline sync forwarding request missing required fields in payload.');
    return NextResponse.json({ error: 'Request payload missing originalEndpoint, originalMethod, or tenantId.' }, { status: 400 });
  }
  
  return forwardRequest(actionPayload);
}