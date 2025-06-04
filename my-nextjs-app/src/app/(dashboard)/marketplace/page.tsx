// app/marketplace/page.tsx
'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Filter, ChevronDown } from 'lucide-react';
import logger from '@/lib/logging';
import { SkeletonLoader } from '../../../../packages/ui/src/SkeletonLoader/SkeletonLoader';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { fetchIntegrations, installIntegration } from '@/lib/api/integrations';

import { FixedSizeList, ListChildComponentProps as RLListChildComponentProps } from 'react-window'; // Renamed to avoid conflict if any
import AutoSizer from 'react-virtualized-auto-sizer';
import debounce from 'lodash/debounce';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';

// Error Boundary Fallback Component
const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => (
  <div className="container mx-auto p-4 md:p-8 text-center text-error">
    <h2 className="text-2xl font-semibold mb-4">Something went wrong</h2>
    <p className="mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-primary text-background rounded-lg hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
    >
      Try Again
    </button>
  </div>
);

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  isInstalled: boolean;
}

const MarketplacePageSkeleton: React.FC = () => (
  <div className="container mx-auto p-4 md:p-8">
    <header className="mb-8">
      <SkeletonLoader className="h-8 w-1/3 mb-2 rounded" data-testid="skeleton-loader-title" />
      <SkeletonLoader className="h-4 w-1/2 rounded" data-testid="skeleton-loader-subtitle" />
    </header>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonLoader key={i} className="h-64 rounded-xl" data-testid={`skeleton-loader-card-${i}`} />
      ))}
    </div>
  </div>
);

import { TFunction } from 'i18next'; // Import TFunction

interface IntegrationCardProps {
  integration: Integration;
  onInstall: (id: string) => void;
  t: TFunction<any, any>; // Use TFunction or a compatible general type
}

const IntegrationCard: React.FC<IntegrationCardProps> = React.memo(({ integration, onInstall, t }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="bg-surface rounded-xl shadow-lg p-6 flex flex-col h-full"
  >
    <div className="flex items-center space-x-4 mb-4">
      <img src={integration.icon} alt={`${integration.name} icon`} className="h-12 w-12 rounded" />
      <div>
        <h3 className="text-xl font-semibold">{integration.name}</h3>
        <p className="text-sm text-onSurface/70">{integration.category}</p>
      </div>
    </div>
    <p className="text-onSurface/80 flex-1 mb-4">{integration.description}</p>
    <button
      onClick={() => onInstall(integration.id)}
      disabled={integration.isInstalled}
      className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
        integration.isInstalled
          ? 'bg-success/20 text-success cursor-not-allowed'
          : 'bg-primary text-background hover:bg-primary-hover'
      }`}
      aria-label={
        integration.isInstalled
          ? t('installed', `{{name}} is installed`, { name: integration.name })
          : t('install', `Install {{name}}`, { name: integration.name })
      }
    >
      {integration.isInstalled ? t('installed', 'Installed') : t('install', 'Install')}
    </button>
  </motion.div>
));

interface FixedSizeListData {
  integrations: Integration[];
  onInstall: (id: string) => void;
  t: TFunction<any, any>; // Use TFunction or a compatible general type
}

const Row: React.FC<RLListChildComponentProps<FixedSizeListData>> = ({ index, style, data }) => {
  const { integrations, onInstall, t: translate } = data; // renamed t to avoid conflict if any
  const integration = integrations[index];
  if (!integration) return null; // Should not happen if itemCount is correct
  return (
    <div style={style} className="px-2 py-2"> {/* Added padding for items in list */}
      <IntegrationCard
        integration={integration}
        onInstall={onInstall}
        t={translate}
      />
    </div>
  );
};


const MarketplacePage: React.FC = () => {
  const { t } = useTranslation('marketplace');
  const { data: session, status } = useSession();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [filteredIntegrations, setFilteredIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const debouncedSetSearchTerm = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  const handleFilterKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsFilterOpen(false);
    }
  }, []);

  const loadIntegrations = useCallback(async () => {
    // Added useCallback for the main fetch function
    setIsLoading(true);
    try {
      logger.info({ stage: 'marketplace_load_start', tenantId: session?.user?.tenantId }, 'Fetching integrations for marketplace.');
      const data = await fetchIntegrations(session?.user?.tenantId);
      setIntegrations(data);
      setFilteredIntegrations(data);

      const uniqueCategories = ['All', ...new Set(data.map((item: Integration) => item.category))];
      setCategories(uniqueCategories);
    } catch (error: any) {
      logger.error({ error: error.message, stage: 'marketplace_load_error' }, 'Failed to load integrations.');
      toast.error(t('loadError', 'Failed to load integrations.'));
      // Do not re-throw here if ErrorBoundary is used at top level, let it be handled by toast
    } finally {
      setIsLoading(false);
    }
  }, [session, t]); // Removed status from deps as it's checked before calling

  useEffect(() => {
    if (status === 'authenticated') {
      loadIntegrations();
    }
  }, [status, loadIntegrations]); // Use loadIntegrations in deps

  useEffect(() => {
    let filtered = [...integrations];
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    setFilteredIntegrations(filtered);
  }, [searchTerm, selectedCategory, integrations]);

  const handleInstall = async (integrationId: string) => {
    try {
      logger.info({ integrationId, stage: 'marketplace_install_start', tenantId: session?.user?.tenantId, userId: session?.user?.id }, 'Installing integration.');
      await installIntegration(integrationId, session?.user?.tenantId, session?.user?.id);
      // Optimistic update
      const updatedIntegrations = integrations.map(item =>
        item.id === integrationId ? { ...item, isInstalled: true } : item
      );
      setIntegrations(updatedIntegrations);
      // filteredIntegrations will update via its own useEffect
      toast.success(
        t('installSuccess', `{{name}} installed successfully!`, { name: integrations.find(item => item.id === integrationId)?.name })
      );
    } catch (error: any) {
      logger.error({ error: error.message, integrationId, stage: 'marketplace_install_error' }, 'Failed to install integration.');
      toast.error(t('installError', 'Failed to install integration.'));
    }
  };

  if (status === 'loading') return <MarketplacePageSkeleton />;
  if (status === 'unauthenticated') return <div className="container mx-auto p-4 md:p-8 text-center">{t('pleaseSignIn', 'Please sign in to access the marketplace.')}</div>;

  const itemData: FixedSizeListData = { 
    integrations: filteredIntegrations, 
    onInstall: handleInstall, 
    t 
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        loadIntegrations(); // Call the memoized loadIntegrations
      }}
      onError={(error: Error, info: React.ErrorInfo) => logger.error({ error: error.message, componentStack: info.componentStack, stage: 'marketplace_render_errorboundary' }, 'MarketplacePage ErrorBoundary caught an error')}
    >
      <Suspense fallback={<MarketplacePageSkeleton />}>
        <div className="container mx-auto p-4 md:p-8">
          <header className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-semibold mb-2">{t('title', 'Integration Marketplace')}</h1>
            <p className="text-lg text-onSurface/80">{t('description', 'Enhance your SEED-OS experience with powerful integrations.')}</p>
          </header>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-onSurface/50" />
              <input
                type="text"
                placeholder={t('searchPlaceholder', 'Search integrations...')}
                onChange={(e) => debouncedSetSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface border border-surface/20 rounded-lg text-onSurface focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={t('searchLabel', 'Search for integrations')}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                onKeyDown={handleFilterKeyDown}
                className="flex items-center justify-between w-full md:w-auto px-4 py-2 bg-surface border border-surface/20 rounded-lg text-onSurface hover:bg-surface/50 focus:outline-none focus:ring-2 focus:ring-primary"
                aria-expanded={isFilterOpen}
                aria-controls="filter-menu"
                aria-label={t('filterLabel', 'Filter integrations by category')}
              >
                <span>{t('category', 'Category')}: {selectedCategory}</span> <ChevronDown className={`ml-2 h-5 w-5 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isFilterOpen && (
                  <motion.ul
                    id="filter-menu"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute mt-2 w-full md:w-56 bg-surface border border-surface/20 rounded-lg shadow-lg z-10 right-0 md:right-auto"
                  >
                    {categories.map(category => (
                      <li key={category}>
                        <button
                          onClick={() => {
                            setSelectedCategory(category);
                            setIsFilterOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-onSurface hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
                        >
                          {category}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </div>

          {isLoading ? (
            <MarketplacePageSkeleton />
          ) : (
            <div className="h-[calc(100vh-280px)]"> {/* Example height, adjust as needed */}
              <AutoSizer>
                {({ height, width }: { height: number; width: number }) => (
                  <FixedSizeList
                    height={height}
                    width={width}
                    itemCount={filteredIntegrations.length}
                    itemSize={200} // Adjusted item size for better card display
                    itemData={itemData}
                    // className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" // FixedSizeList manages layout, not Tailwind grid here
                  >
                    {Row}
                  </FixedSizeList>
                )}
              </AutoSizer>
            </div>
          )}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

export default MarketplacePage;
