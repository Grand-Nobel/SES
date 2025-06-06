'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the NotificationsContent component
const NotificationsContent = dynamic(() => import('./NotificationsContent'), {
  ssr: false, // Ensure this component is only rendered on the client side
});

const NotificationsPage: React.FC = () => {
  return <NotificationsContent />;
};

export default NotificationsPage;
