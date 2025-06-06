import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logging'; // Assuming logger is setup in Next.js app

// TODO: Replace with actual fetch from marketplace-service when available
const MOCK_MARKETPLACE_SERVICE_URL = 'http://localhost:3005/api/v1/marketplace/connectors';

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('X-Tenant-ID'); // Example: Tenant context from header

  if (!tenantId) {
    logger.warn('Marketplace connectors request missing X-Tenant-ID header');
    return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
  }

  logger.info({ tenantId }, `Fetching marketplace connectors for tenant.`);

  try {
    // In a real scenario, you would fetch this from the marketplace-service:
    // const response = await fetch(`${MOCK_MARKETPLACE_SERVICE_URL}?tenantId=${tenantId}`, {
    //   headers: {
    //     // Forward necessary headers, handle auth if marketplace-service is protected
    //   }
    // });
    // if (!response.ok) {
    //   const errorData = await response.text();
    //   logger.error({ tenantId, status: response.status, error: errorData }, 'Failed to fetch connectors from marketplace-service');
    //   return NextResponse.json({ error: 'Failed to fetch marketplace connectors', details: errorData }, { status: response.status });
    // }
    // const connectors = await response.json();

    // Mock data for now:
    const mockConnectors = [
      {
        id: 'mkp-conn-google-drive',
        name: 'Google Drive Connector',
        description: 'Integrate with Google Drive for file synchronization and management.',
        service_identifier: 'google-drive',
        logo_url: '/icons/google-drive.svg', // Placeholder
        category: 'File Storage',
        vendor: 'Google',
        is_featured: true,
      },
      {
        id: 'mkp-conn-slack',
        name: 'Slack Connector',
        description: 'Receive notifications and interact with Slack channels.',
        service_identifier: 'slack',
        logo_url: '/icons/slack.svg', // Placeholder
        category: 'Communication',
        vendor: 'Slack',
        is_featured: false,
      },
      {
        id: 'mkp-conn-salesforce',
        name: 'Salesforce Connector',
        description: 'Sync customer data and automate workflows with Salesforce.',
        service_identifier: 'salesforce',
        logo_url: '/icons/salesforce.svg', // Placeholder
        category: 'CRM',
        vendor: 'Salesforce',
        is_featured: true,
      }
    ];

    // TODO: Implement actual call to marketplace-service
    logger.info({ tenantId, count: mockConnectors.length }, 'Successfully fetched mock marketplace connectors.');
    return NextResponse.json(mockConnectors);

  } catch (error: any) {
    logger.error({ tenantId, error: error.message, stack: error.stack }, 'Error fetching marketplace connectors');
    return NextResponse.json({ error: 'An unexpected error occurred while fetching marketplace connectors.' }, { status: 500 });
  }
}

// Optional: Implement caching if connector list doesn't change often
// export const revalidate = 3600; // Revalidate every hour
// export const dynamic = 'force-static'; // If data is truly static for a build