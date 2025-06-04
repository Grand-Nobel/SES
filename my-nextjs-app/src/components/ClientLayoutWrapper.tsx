"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

const WebSocketProvider = dynamic(() => import('./WebSocketProvider'), { ssr: false });

const ClientLayoutWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WebSocketProvider>{children}</WebSocketProvider>
    </Suspense>
  );
};

export default ClientLayoutWrapper;
