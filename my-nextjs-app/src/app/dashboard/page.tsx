'use client';

import 'react'; // Explicitly import react
import 'react-dom'; // Explicitly import react-dom
import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the DashboardContent component
const DashboardContent = dynamic(() => import('./DashboardContent'), {
  ssr: false, // Ensure this component is only rendered on the client side
});

const DashboardPage: React.FC = () => {
  console.log('Rendering DashboardPage');
  return <DashboardContent />;
};

export default DashboardPage;
