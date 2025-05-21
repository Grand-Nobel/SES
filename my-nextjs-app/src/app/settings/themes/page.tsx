'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the ThemesContent component
const ThemesContent = dynamic(() => import('./ThemesContent'), {
  ssr: false, // Ensure this component is only rendered on the client side
});

const ThemesPage: React.FC = () => {
  return <ThemesContent />;
};

export default ThemesPage;
