"use client";
"use client";
import React, { useEffect } from 'react';
import { subscribeToAgentActions } from '@/lib/websocket';
import { AgentUIAction } from '@/types/agent';

const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // In a real application, tenantId would be dynamically obtained from session or context
    const tenantId = 'your-tenant-id-placeholder'; 

    console.log('WebSocketProvider: Establishing connection...');
    const unsubscribe = subscribeToAgentActions(tenantId, (action: AgentUIAction) => {
      console.log('Received agent action:', action);
      // Further logic to dispatch actions to state management (e.g., Jotai, Zustand)
    });

    return () => {
      console.log('WebSocketProvider: Closing connection...');
      unsubscribe(); // Assuming subscribeToAgentActions returns an unsubscribe function
    };
  }, []);

  return <>{children}</>;
};

export default WebSocketProvider;
