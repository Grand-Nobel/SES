import logger from '@/lib/logging';
import ConnectorCard from './ConnectorCard';
// import { Suspense } from 'react'; // Suspense is unused

interface MarketplaceConnector {
  id: string;
  name: string;
  description: string;
  service_identifier: string;
  logo_url?: string;
  category?: string;
  vendor?: string;
  is_featured?: boolean;
}

async function fetchMarketplaceConnectors(tenantId: string): Promise<MarketplaceConnector[]> {
  // In a real app, tenantId might come from session or context
  // For now, we'll assume it's passed or handled by the API layer
  logger.info({ tenantId }, 'Fetching marketplace connectors for UI');
  try {
    // Construct absolute URL for fetch in Server Components
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const apiUrl = `${appUrl}/api/integrations/marketplace/connectors`;
    
    logger.info({ apiUrl }, 'Constructed API URL for fetching marketplace connectors');

    const response = await fetch(apiUrl, {
      headers: {
        'X-Tenant-ID': tenantId, // Pass tenant context
      },
      // cache: 'no-store', // Use this if data changes very frequently
      next: { revalidate: 3600 } // Revalidate every hour, or adjust as needed
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText, tenantId }, 'Failed to fetch marketplace connectors for UI');
      // Throw an error to be caught by an Error Boundary or the nearest error.tsx
      throw new Error(`Failed to fetch marketplace connectors: ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    logger.info({ tenantId, count: data.length }, 'Successfully fetched marketplace connectors for UI');
    return data as MarketplaceConnector[];
  } catch (error: any) {
    logger.error({ error: error.message, tenantId, stack: error.stack }, 'Exception while fetching marketplace connectors for UI');
    // Re-throw to be caught by Error Boundary or error.tsx
    throw error; 
  }
}

// Mock tenantId for now, this would come from user session or similar context
const MOCK_TENANT_ID = 'tenant-123-abc';

export default async function Marketplace() {
  // This is a Server Component, so we can fetch data directly.
  // The fetchMarketplaceConnectors function will call our BFF Route Handler.
  
  // Note: Error handling for fetchMarketplaceConnectors will be caught by the nearest error.tsx
  // or a custom ErrorBoundary if wrapped.
  let connectors: MarketplaceConnector[] = [];
  try {
    connectors = await fetchMarketplaceConnectors(MOCK_TENANT_ID);
  } catch (error: unknown) { // Changed any to unknown
    const errorMessage = error instanceof Error ? error.message : 'Failed to load connectors';
    logger.error({ error: errorMessage, tenantId: MOCK_TENANT_ID }, 'Marketplace page failed to load connectors');
    // Render an error state or allow error.tsx to handle it
    // For now, returning a message directly:
    return (
      <div className="p-4">
        <h2 className="text-2xl font-semibold mb-4">Integration Marketplace</h2>
        <p className="text-red-500">Error loading connectors: {errorMessage}</p>
      </div>
    );
  }


  if (!connectors || connectors.length === 0) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-semibold mb-4">Integration Marketplace</h2>
        <p>No connectors are currently available in the marketplace. Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-6">Integration Marketplace</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {connectors.map((connector) => (
          <ConnectorCard key={connector.id} connector={connector} tenantId={MOCK_TENANT_ID} />
        ))}
      </div>
    </div>
  );
}

// Example of how to use Suspense if ConnectorCard was a separate async component
// or if parts of the marketplace loaded at different times.
// For now, Marketplace itself is an async component fetching all data.
//
// function MarketplaceContent() {
//   // const connectors = use(fetchMarketplaceConnectors(MOCK_TENANT_ID)); // if using experimental use hook
//   return (
//      ... main content here ...
//   );
// }
//
// export default function MarketplacePage() {
//   return (
//     <Suspense fallback={<MarketplaceSkeleton />}>
//       <MarketplaceContent />
//     </Suspense>
//   );
// }
//
// function MarketplaceSkeleton() {
//   return <p>Loading marketplace...</p>;
// }
