import { Suspense } from 'react';
import logger from '@/lib/logging';
import IntegrationsList, { IntegrationsListSkeleton } from '@/components/integrations/dashboard/IntegrationsList';
// import Marketplace from '@/components/integrations/marketplace/Marketplace'; // Already created

// Mock function to simulate fetching installed integrations for a tenant
// In a real app, this would call a BFF endpoint that talks to connector-service
interface InstalledIntegration {
  id: string; // Corresponds to integration_connectors.id
  connectorName: string; // e.g., "My Google Drive"
  serviceName: string; // e.g., "google-drive-basic"
  status: 'active' | 'inactive' | 'error';
  lastConnectedAt?: string;
  // Add other relevant details for display
}

async function getInstalledIntegrations(tenantId: string): Promise<InstalledIntegration[]> {
  logger.info({ tenantId }, "Fetching installed integrations for dashboard.");
  // Placeholder: Replace with actual API call to a BFF endpoint
  // e.g., const response = await fetch(`/api/integrations/installed?tenantId=${tenantId}`);
  // const data = await response.json();
  // return data;

  // Mock data for now
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  if (tenantId === 'tenant-123-abc') {
    return [
      { id: 'conn-123', connectorName: 'My Personal Drive', serviceName: 'google-drive-basic', status: 'active', lastConnectedAt: new Date().toISOString() },
      { id: 'conn-456', connectorName: 'Team Slack Notifications', serviceName: 'slack-notifications', status: 'inactive' },
      { id: 'conn-789', connectorName: 'Sales CRM Link', serviceName: 'salesforce-crm', status: 'error' },
    ];
  }
  return [];
}

// Mock tenantId, this would come from session/auth context
const MOCK_TENANT_ID = 'tenant-123-abc';


// Placeholder for Marketplace component if it were fetched here
// For now, Marketplace is a separate component that fetches its own data.
// If we wanted to show a snippet or link, we could.
function MarketplaceTeaser() {
    return (
        <div className="mt-8 p-4 border rounded-md bg-blue-50">
            <h3 className="text-xl font-semibold mb-2">Discover New Integrations</h3>
            <p className="mb-3">Expand your capabilities by connecting new services from our marketplace.</p>
            {/* In a real app, this would be a <Link href="/integrations/marketplace"> or similar */}
            <a href="#" className="text-blue-600 hover:underline">Go to Marketplace &rarr;</a>
        </div>
    );
}
// --- End of components to be created later ---


export default async function IntegrationsDashboardPage() {
  // This is a Server Component.
  // It can fetch data directly or delegate to child Server Components.

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Integration Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your connected services and explore new integrations from the marketplace.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Your Installed Integrations</h2>
        <Suspense fallback={<IntegrationsListSkeleton />}>
          <IntegrationsList tenantId={MOCK_TENANT_ID} />
        </Suspense>
      </section>

      <section>
        {/* 
          The full Marketplace component is likely a separate page or a more complex client component.
          Here, we might just show a link or a small preview.
          For now, using a simple teaser.
        */}
        {/* <Marketplace /> */} {/* This would embed the full marketplace if desired */}
        <MarketplaceTeaser />
      </section>
    </div>
  );
}