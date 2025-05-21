import Marketplace from '@/components/integrations/marketplace/Marketplace';
import { Suspense } from 'react';
import logger from '@/lib/logging';

// Placeholder for a skeleton loader for the marketplace page
function MarketplacePageSkeleton() {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg p-4 shadow-sm animate-pulse">
            <div className="h-12 w-12 mb-3 bg-gray-200 rounded"></div>
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
            <div className="h-16 bg-gray-200 rounded mb-3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/4 mb-3"></div>
            <div className="h-10 bg-gray-300 rounded-md"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function MarketplacePage() {
  logger.info('Rendering MarketplacePage');
  // The Marketplace component is a Server Component and fetches its own data.
  // We wrap it in Suspense for a better loading experience.
  return (
    <Suspense fallback={<MarketplacePageSkeleton />}>
      {/* 
        The @ts-expect-error directive is used here because TypeScript's default JSX typings 
        might not fully recognize async Server Components as valid JSX elements without 
        explicit configuration or if certain experimental flags aren't perfectly aligned.
        Next.js itself handles this correctly.
      */}
      <Marketplace />
    </Suspense>
  );
}