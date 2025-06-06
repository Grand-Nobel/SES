import { useState } from 'react';
import { motion } from 'framer-motion';
import { useShadowStateStore } from '@/stores/shadowStateStore';

// Define a more specific type for local and server data if possible
// For now, using Record<string, unknown> is better than any
interface ConflictData {
  actionId: string;
  target: string;
  // Add other known properties
  [key: string]: unknown; // Allows for other properties
}

interface Conflict {
  local: ConflictData;
  server: ConflictData;
  timestamp: string;
}

const ConflictResolver = ({ conflict }: { conflict: Conflict }) => {
  const { setActiveVisualization } = useShadowStateStore();
  const [resolution, setResolution] = useState<'local' | 'server' | 'merge'>('server');

  const handleResolve = () => {
    if (resolution === 'local') {
      setActiveVisualization({ actionId: conflict.local.actionId, uiTarget: conflict.local.target, proposedChanges: conflict.local });
    } else if (resolution === 'server') {
      setActiveVisualization({ actionId: conflict.server.actionId, uiTarget: conflict.server.target, proposedChanges: conflict.server });
    } else {
      const merged = { ...conflict.local, ...conflict.server };
      setActiveVisualization({ actionId: crypto.randomUUID(), uiTarget: conflict.local.target, proposedChanges: merged });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="modal"
    >
      <h2>Conflict Detected</h2>
      <p>Local: {JSON.stringify(conflict.local)}</p>
      <p>Server: {JSON.stringify(conflict.server)}</p>
      <select onChange={(e) => setResolution(e.target.value as 'local' | 'server' | 'merge')}>
        <option value="local">Keep Local</option>
        <option value="server">Use Server</option>
        <option value="merge">Merge Changes</option>
      </select>
      <button onClick={handleResolve}>Resolve</button>
    </motion.div>
  );
};

export default ConflictResolver;
