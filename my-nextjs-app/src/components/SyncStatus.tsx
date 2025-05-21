'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // Assuming react-i18next is configured
import { OfflineMutationManager } from '../lib/api/offlineMutationManager'; // Adjusted path
import './SyncStatus.module.css'; // Assuming CSS module will be created here

const SyncStatus: React.FC = () => {
  const { t } = useTranslation('topbar'); // Assuming 'topbar' namespace has these keys
  const [queueCount, setQueueCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true); // Assume online by default

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    const offlineManager = OfflineMutationManager.getInstance(); // Use singleton instance
    
    const updateStatus = () => {
      setQueueCount(offlineManager.getQueueCount());
      setLastSync(offlineManager.getLastSync());
      if (typeof window !== 'undefined') {
        setIsOnline(navigator.onLine);
      }
    };

    updateStatus(); // Initial status

    // Listen to custom events from OfflineMutationManager
    const handleQueueUpdated = () => updateStatus();
    const handleSyncCompleted = () => updateStatus();
    
    offlineManager.addEventListener('queueUpdated', handleQueueUpdated);
    offlineManager.addEventListener('syncCompleted', handleSyncCompleted);

    // Listen to browser online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      updateStatus(); // Re-check queue on going online
      // Optionally trigger sync attempt if queue > 0
      if (offlineManager.getQueueCount() > 0) {
        offlineManager.processQueue(); 
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      updateStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const interval = setInterval(updateStatus, 60000); // Periodic update every minute

    return () => {
      clearInterval(interval);
      offlineManager.removeEventListener('queueUpdated', handleQueueUpdated);
      offlineManager.removeEventListener('syncCompleted', handleSyncCompleted);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [t]);

  if (!isOnline && queueCount === 0) {
    return <div className="sync-status sync-status--offline" data-testid="sync-status">{t('status_offline', { defaultValue: 'Offline' })}</div>;
  }
  
  if (queueCount > 0) {
    return <div className="sync-status sync-status--syncing" data-testid="sync-status">{t('sync_status_pending', { count: queueCount, defaultValue: `Syncing ${queueCount} items...` })}</div>;
  }

  return (
    <div className="sync-status sync-status--synced" data-testid="sync-status">
      {isOnline ? t('status_synced', { defaultValue: 'Synced' }) : t('status_offline_synced', { defaultValue: 'Offline (Synced)' })}
      {lastSync && (
        <span className="sync-status__last-sync">
          {' '}{t('last_sync_time', { time: lastSync.toLocaleTimeString(), defaultValue: `(Last: ${lastSync.toLocaleTimeString()})` })}
        </span>
      )}
    </div>
  );
};

export default SyncStatus; // Changed to default export to match existing file structure
