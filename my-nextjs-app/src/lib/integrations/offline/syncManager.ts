'use client'; // This module will be used client-side

import offlineQueue from './OfflineQueue';
import logger from '@/lib/logging';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds, can be made exponential

let isSyncing = false;
let online = typeof navigator !== 'undefined' ? navigator.onLine : true; // Assume online in non-browser env for SSR

function updateOnlineStatus() {
  const newStatus = navigator.onLine;
  if (online !== newStatus) {
    online = newStatus;
    logger.info(`Network status changed. Online: ${online}`);
    if (online) {
      triggerSync();
    }
  }
}

async function processQueue() {
  if (isSyncing || !online) {
    if (!online) logger.info('Offline, skipping queue processing.');
    return;
  }

  isSyncing = true;
  logger.info('Starting offline queue processing...');

  let action = await offlineQueue.getNextAction();
  while (action && online) { // Continue if there are actions and we are still online
    logger.info({ actionId: action.id, actionType: action.actionType }, 'Processing action from queue.');
    try {
      // Target the new BFF endpoint for offline sync
      const bffSyncEndpoint = '/api/integrations/sync-offline';
      const payloadForBff = {
        originalEndpoint: action.endpoint,
        originalMethod: action.method,
        originalPayload: action.payload,
        tenantId: action.tenantId,
        actionType: action.actionType, // Pass for logging/context on BFF
        originalActionId: action.id    // Pass for logging/context on BFF
      };

      const response = await fetch(bffSyncEndpoint, {
        method: 'POST', // Always POST to the BFF sync endpoint
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': action.tenantId, // BFF might also use this for top-level auth/routing
        },
        body: JSON.stringify(payloadForBff),
      });

      if (response.ok) {
        logger.info({ actionId: action.id, status: response.status }, 'Action processed successfully and sent to server.');
        await offlineQueue.deleteAction(action.id);
      } else {
        logger.warn({ actionId: action.id, status: response.status, response: await response.text() }, 'Action failed to process on server.');
        if (action.retries < MAX_RETRIES) {
          action.retries += 1;
          await offlineQueue.updateActionRetries(action.id, action.retries);
          logger.info({ actionId: action.id, retries: action.retries }, 'Action will be retried.');
          // For simplicity, we'll let the next triggerSync pick it up after a delay.
          // A more sophisticated retry would handle its own delay or move to a separate retry queue.
          // For now, break the loop and wait for next online event or manual trigger.
          break; 
        } else {
          logger.error({ actionId: action.id }, 'Action failed after max retries. Removing from queue.');
          await offlineQueue.deleteAction(action.id); // Or move to a "dead letter" queue
        }
      }
    } catch (error: unknown) { // Changed any to unknown
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error({ actionId: action.id, error: errorMessage, stack: errorStack }, 'Network or unexpected error processing action.');
      if (action.retries < MAX_RETRIES) {
        action.retries += 1;
        await offlineQueue.updateActionRetries(action.id, action.retries);
        logger.info({ actionId: action.id, retries: action.retries }, 'Action will be retried due to network/exception.');
        break; // Break and retry later
      } else {
        logger.error({ actionId: action.id }, 'Action failed after max retries due to network/exception. Removing from queue.');
        await offlineQueue.deleteAction(action.id);
      }
      // If network error, online status might change, which will re-trigger sync.
    }
    
    if (!online) { // Check online status again before fetching next action
        logger.info('Went offline during queue processing. Pausing.');
        break;
    }
    action = await offlineQueue.getNextAction();
  }

  isSyncing = false;
  logger.info('Offline queue processing finished.');
  
  // If there are still items and we are online, try again after a delay
  // This handles cases where an item was retried and broke the loop
  if (online && (await offlineQueue.getNextAction())) {
    setTimeout(triggerSync, RETRY_DELAY_MS);
  }
}

export function triggerSync() {
  if (typeof window !== 'undefined') { // Ensure it runs only in browser
    logger.info('Manual sync trigger requested.');
    if (!online) {
        logger.warn('Cannot trigger sync: currently offline.');
        return;
    }
    if (isSyncing) {
        logger.info('Sync already in progress.');
        return;
    }
    processQueue();
  }
}

export function initializeSyncManager() {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    logger.info('SyncManager initialized with online/offline event listeners.');
    // Initial check and sync attempt if online
    if (online) {
      triggerSync();
    }
  } else {
    logger.info('SyncManager: Not in a browser environment, skipping event listener setup.');
  }
}

// Automatically initialize when this module is loaded in a client environment
// This could also be called from a main application setup file (e.g., _app.tsx or a layout client component)
// initializeSyncManager(); // Commented out to allow manual initialization from app
