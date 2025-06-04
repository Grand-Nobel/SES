'use client';

import { useState } from 'react';
import logger from '@/lib/logging';

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

interface ConnectorCardProps {
  connector: MarketplaceConnector;
  tenantId: string; // Passed from the parent Server Component
}

export default function ConnectorCard({ connector, tenantId }: ConnectorCardProps) {
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleInstall = async () => {
    if (!tenantId) {
      logger.error({ connectorId: connector.id }, 'Tenant ID is missing, cannot install connector.');
      setInstallStatus({ success: false, message: 'Error: Tenant ID is missing.' });
      return;
    }

    setIsInstalling(true);
    setInstallStatus(null);
    logger.info({ connectorId: connector.id, tenantId }, `Initiating installation for connector.`);

    try {
      const response = await fetch('/api/integrations/marketplace/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
        },
        body: JSON.stringify({ marketplaceConnectorId: connector.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        logger.error({ connectorId: connector.id, tenantId, status: response.status, error: result.error || result.details }, 'Installation API call failed');
        setInstallStatus({ success: false, message: `Installation failed: ${result.error || result.details || 'Unknown error'}` });
      } else {
        logger.info({ connectorId: connector.id, tenantId, result }, 'Installation successful via API');
        setInstallStatus({ success: true, message: result.message || 'Installation initiated successfully!' });
        // Optionally, you might want to trigger a re-fetch of installed connectors or navigate the user.
      }
    } catch (error: unknown) { // Changed any to unknown
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      logger.error({ connectorId: connector.id, tenantId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined }, 'Exception during installation API call');
      setInstallStatus({ success: false, message: `Installation error: ${errorMessage}` });
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
      <div>
        {connector.logo_url && (
          <img 
            src={connector.logo_url} 
            alt={`${connector.name} logo`} 
            className="h-12 w-12 mb-3 object-contain"
            onError={(e) => (e.currentTarget.style.display = 'none')} // Hide if image fails to load
          />
        )}
        <h3 className="text-xl font-medium mb-1">{connector.name}</h3>
        <p className="text-sm text-gray-600 mb-1">By {connector.vendor || 'Unknown Vendor'}</p>
        <p className="text-sm text-gray-500 mb-3 min-h-[60px]">{connector.description}</p> {/* min-h for consistent card height */}
        <p className="text-xs text-gray-400 mb-3">Category: {connector.category || 'General'}</p>
      </div>
      <div>
        {installStatus && (
          <p className={`text-sm mb-2 ${installStatus.success ? 'text-green-600' : 'text-red-600'}`}>
            {installStatus.message}
          </p>
        )}
        <button
          className={`w-full font-semibold py-2 px-4 rounded-md transition-colors ${
            isInstalling || (installStatus?.success)
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          onClick={handleInstall}
          disabled={isInstalling || (installStatus?.success ?? false)}
        >
          {isInstalling ? 'Installing...' : (installStatus?.success ? 'Installed' : 'Install')}
        </button>
      </div>
    </div>
  );
}
