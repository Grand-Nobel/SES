 'use client';

import { useState } from 'react';
import logger from '@/lib/logging';
import ClientFormattedDate from '@/components/ClientFormattedDate'; // Import the new component
// import { useRouter } from 'next/navigation'; // If needed for navigation

interface InstalledIntegration {
  id: string;
  connectorName: string;
  serviceName: string;
  status: 'active' | 'inactive' | 'error';
  lastConnectedAt?: string;
  // Potentially add auth_config or other details if needed for a "Configure" action
  // auth_config?: Record<string, any>; 
}

interface IntegrationCardProps {
  integration: InstalledIntegration;
  tenantId: string; // Needed for API calls
  // onConfigurationChange?: (integrationId: string) => void; // Callback after config change
  // onDelete?: (integrationId: string) => void; // Callback after delete
}

export default function IntegrationCard({ integration, tenantId }: IntegrationCardProps) {
  // const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfigure = () => {
    logger.info({ integrationId: integration.id, tenantId }, 'Configure action clicked.');
    // Placeholder: Navigate to a configuration page or open a modal
    // router.push(`/dashboard/integrations/${integration.id}/configure`);
    alert(`Configure: ${integration.connectorName} (ID: ${integration.id}) - Tenant: ${tenantId}`);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the "${integration.connectorName}" integration?`)) {
      return;
    }
    setIsLoading(true);
    setError(null);
    logger.info({ integrationId: integration.id, tenantId }, 'Delete action initiated.');
    try {
      // This would call a BFF endpoint, which then calls the connector-service
      const response = await fetch(`/api/integrations/manage/${integration.id}`, { // Example endpoint
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        logger.error({ integrationId: integration.id, tenantId, status: response.status, error: errData }, 'Failed to delete integration.');
        setError(errData.error || 'Failed to delete integration.');
        throw new Error(errData.error || 'Failed to delete integration.');
      }
      
      logger.info({ integrationId: integration.id, tenantId }, 'Integration deleted successfully.');
      alert('Integration deleted (mock). In a real app, this card would be removed or UI updated.');
      // onDelete?.(integration.id); // Trigger callback to update parent list
      
    } catch (err: any) {
      logger.error({ integrationId: integration.id, tenantId, error: err.message }, 'Exception during delete integration.');
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleToggleActive = async () => {
    setIsLoading(true);
    setError(null);
    const newStatus = integration.status === 'active' ? 'inactive' : 'active';
    logger.info({ integrationId: integration.id, tenantId, newStatus }, `Toggling active status to ${newStatus}.`);

    try {
        // This would call a BFF endpoint, which then calls the connector-service
        const response = await fetch(`/api/integrations/manage/${integration.id}/status`, { // Example endpoint
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': tenantId,
            },
            body: JSON.stringify({ isActive: newStatus === 'active' })
        });

        if (!response.ok) {
            const errData = await response.json();
            logger.error({ integrationId: integration.id, tenantId, status: response.status, error: errData }, 'Failed to toggle integration status.');
            setError(errData.error || 'Failed to update status.');
            throw new Error(errData.error || 'Failed to update status.');
        }
        logger.info({ integrationId: integration.id, tenantId }, 'Integration status updated successfully.');
        alert(`Status changed to ${newStatus} (mock). In a real app, UI would update.`);
        // Potentially update local state or re-fetch to reflect change
    } catch (err: any) {
        logger.error({ integrationId: integration.id, tenantId, error: err.message }, 'Exception during toggle active status.');
        setError(err.message || 'An unexpected error occurred.');
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{integration.connectorName}</h3>
          <p className="text-sm text-gray-500">Service: {integration.serviceName}</p>
        </div>
        <span
          className={`px-2 py-1 text-xs font-semibold rounded-full cursor-pointer ${
            integration.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
            integration.status === 'error' ? 'bg-red-100 text-red-700' : // Error status not typically toggleable by user directly
            'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
          }`}
          onClick={integration.status !== 'error' ? handleToggleActive : undefined}
          title={integration.status !== 'error' ? `Click to toggle status (current: ${integration.status})` : `Status: ${integration.status}`}
        >
          {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
        </span>
      </div>

      {integration.lastConnectedAt && (
        <p className="text-xs text-gray-500 mb-3">
          Last connected: <ClientFormattedDate dateString={integration.lastConnectedAt} />
        </p>
      )}
      
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <div className="mt-3 pt-3 border-t border-gray-200 flex space-x-2">
        <button 
          onClick={handleConfigure} 
          disabled={isLoading}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          Configure
        </button>
        <button 
          onClick={() => alert(`View Logs for ${integration.connectorName} (Not Implemented)`)} 
          disabled={isLoading}
          className="text-xs text-gray-600 hover:underline disabled:opacity-50"
        >
          View Logs
        </button>
        <button 
          onClick={handleDelete} 
          disabled={isLoading}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          {isLoading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
