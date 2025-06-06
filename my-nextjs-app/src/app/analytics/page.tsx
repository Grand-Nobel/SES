'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the AnalyticsContent component
const AnalyticsContent = dynamic(() => import('./AnalyticsContent'), {
  ssr: false, // Ensure this component is only rendered on the client side
});

const AnalyticsPage: React.FC = () => {
  return <AnalyticsContent />;
};

export default AnalyticsPage;
