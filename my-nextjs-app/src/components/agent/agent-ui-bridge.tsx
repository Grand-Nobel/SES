import React, { memo, useState } from 'react';
import { useWindowSize } from '@/hooks/useWindowSize';

import { AgentUIAction } from '@/types/agent';

const AgentUIBridge = memo(({ action }: { action: AgentUIAction }) => {
  const { width } = useWindowSize();
  const [showDebug, setShowDebug] = useState(false);

  const getPromptContext = (depth: 'minimal' | 'expanded') => {
    switch (depth) {
      case 'minimal': return action.payload.latestMessage;
      case 'expanded': return { ...action.payload, metadata: action.metadata, trace: action.metadata?.traceId };
    }
  };

  const context = width < 600 ? getPromptContext('minimal') : getPromptContext('expanded');

  return (
    <div>
      <div>{JSON.stringify(context)}</div>
      {showDebug && (
        <div className="debug-overlay">
          <p>Agent: {action.metadata?.agentName}</p>
          <p>Timestamp: {action.metadata?.timestamp}</p>
          <p>Target: {action.target}</p>
        </div>
      )}
      <button onClick={() => setShowDebug(!showDebug)}>Toggle Debug</button>
    </div>
  );
});

AgentUIBridge.displayName = 'AgentUIBridge';

export default AgentUIBridge;
