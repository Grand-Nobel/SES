import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OfflineMutationManager } from '@/lib/api/offlineMutationManager';

const OfflineStatus = () => {
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0);

  useEffect(() => {
    const manager = OfflineMutationManager.getInstance(); // Use singleton instance
    const updateCount = async () => {
      const keys = await manager.persister.storage.getAllKeys();
      const count = keys.filter((k: string) => k.startsWith('mutation_')).length;
      setPendingCount(count);
      // Calculate sync progress based on total keys vs pending mutations
      const totalKeys = keys.length;
      setSyncProgress(totalKeys > 0 ? (100 * (totalKeys - count)) / totalKeys : 0);
    };
    updateCount();
    const interval = setInterval(updateCount, 500);
    window.addEventListener('online', () => manager.processQueue(queryClient));
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', () => {});
    };
  }, [queryClient]);

  if (pendingCount === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="toast"
    >
      Offline: {pendingCount} actions pending
      <div className="progress-bar" style={{ width: `${syncProgress}%` }} />
    </motion.div>
  );
};

export default OfflineStatus;
