import logger from '@/lib/logging';
import IntegrationCard from './IntegrationCard';

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
  logger.info({ tenantId }, "Fetching installed integrations for IntegrationsList component.");
  // Placeholder: Replace with actual API call to a BFF endpoint
  // e.g., const response = await fetch(`/api/integrations/installed?tenantId=${tenantId}`);
  // const data = await response.json();
  // return data;

  // Mock data for now
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
  if (tenantId === 'tenant-123-abc') { // Using the same mock tenant ID
    return [
      { id: 'conn-123', connectorName: 'My Personal Drive', serviceName: 'google-drive-basic', status: 'active', lastConnectedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
      { id: 'conn-456', connectorName: 'Team Slack Notifications', serviceName: 'slack-notifications', status: 'inactive' },
      { id: 'conn-789', connectorName: 'Sales CRM Link', serviceName: 'salesforce-crm', status: 'error' },
      { id: 'conn-012', connectorName: 'Dev Analytics Feed', serviceName: 'custom-analytics', status: 'active', lastConnectedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
    ];
  }
  return [];
}


export default async function IntegrationsList({ tenantId }: { tenantId: string }) {
    const installedIntegrations = await getInstalledIntegrations(tenantId);

    if (installedIntegrations.length === 0) {
        return <p className="text-gray-600">No integrations installed yet. Visit the marketplace to add some!</p>;
    }

    return (
        <div className="space-y-4">
            {installedIntegrations.map(integration => (
                <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    tenantId={tenantId}
                    // Pass callbacks here if needed, e.g., for re-fetching list on delete/update
                    // onDelete={() => { /* logic to refresh list */ }}
                />
            ))}
        </div>
    );
}

export function IntegrationsListSkeleton() {
    return (
        <div className="space-y-4">
            {[1, 2].map((i) => (
                <div key={i} className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
            ))}
        </div>
    );
}