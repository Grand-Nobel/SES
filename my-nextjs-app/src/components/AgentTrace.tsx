import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';
import { useShadowStateStore } from '@/stores/shadowStateStore';

import { AgentUIAction } from '@/types/agent';

const AgentTrace = () => {
  const [traces, setTraces] = useState<AgentUIAction[]>([]);
  const { pendingShadowActions } = useShadowStateStore();

  useEffect(() => {
    const handleTrace = (action: AgentUIAction) => {
      setTraces((prev) => [...prev, action].slice(-50));
      Sentry.captureMessage('Agent action traced', {
        extra: { action: action.type, target: action.target, traceId: action.metadata?.traceId },
      });
    };
    // Iterate over pendingShadowActions to add them to traces
    pendingShadowActions.forEach(handleTrace);
  }, [pendingShadowActions]);

  return (
    <div className="debug-panel">
      <h2>Agent Action Trace</h2>
      <ul>
        {traces.map((trace) => (
          <li key={trace.actionId}>
            {trace.metadata?.agentName}: {trace.type} on {trace.target}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AgentTrace;
