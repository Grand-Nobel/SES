'use client'; // This module will be used client-side

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import logger from '@/lib/logging'; // Assuming logger is available client-side

const DB_NAME = 'OfflineIntegrationQueueDB';
const DB_VERSION = 1;
const STORE_NAME = 'actionQueue';

interface QueuedAction {
  id: string; // Unique ID for the action, e.g., timestamp or UUID
  timestamp: number;
  tenantId: string;
  actionType: string; // e.g., 'INSTALL_CONNECTOR', 'UPDATE_CONFIG', 'SYNC_DATA'
  payload: any; // Data related to the action
  endpoint: string; // The API endpoint to call when online
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH'; // HTTP method
  retries: number;
}

interface OfflineQueueDBSchema extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: QueuedAction;
    indexes: { 'timestamp': number };
  };
}

class OfflineQueue {
  private dbPromise: Promise<IDBPDatabase<OfflineQueueDBSchema>>;

  constructor() {
    this.dbPromise = openDB<OfflineQueueDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          logger.info('IndexedDB store "actionQueue" created.');
        }
      },
    });
    logger.info('OfflineQueue initialized.');
  }

  public async queueAction(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const db = await this.dbPromise;
    const queuedItem: QueuedAction = {
      ...action,
      id: crypto.randomUUID(), // Generate a unique ID
      timestamp: Date.now(),
      retries: 0,
    };
    try {
      await db.add(STORE_NAME, queuedItem);
      logger.info({ actionId: queuedItem.id, actionType: action.actionType }, 'Action queued successfully.');
      return queuedItem.id;
    } catch (error) {
      logger.error({ error, action }, 'Failed to queue action.');
      throw error;
    }
  }

  public async getQueuedActions(): Promise<QueuedAction[]> {
    const db = await this.dbPromise;
    return db.getAllFromIndex(STORE_NAME, 'timestamp'); // Get all, ordered by timestamp
  }

  public async getNextAction(): Promise<QueuedAction | undefined> {
    const db = await this.dbPromise;
    const cursor = await db.transaction(STORE_NAME).store.index('timestamp').openCursor();
    return cursor?.value;
  }
  
  public async deleteAction(id: string): Promise<void> {
    const db = await this.dbPromise;
    try {
      await db.delete(STORE_NAME, id);
      logger.info({ actionId: id }, 'Action deleted from queue.');
    } catch (error) {
      logger.error({ error, actionId: id }, 'Failed to delete action from queue.');
      throw error;
    }
  }

  public async updateActionRetries(id: string, retries: number): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const action = await store.get(id);
    if (action) {
      action.retries = retries;
      await store.put(action);
      await tx.done;
      logger.info({ actionId: id, retries }, 'Action retries updated.');
    } else {
      logger.warn({ actionId: id }, 'Attempted to update retries for non-existent action.');
    }
  }

  public async clearQueue(): Promise<void> {
    const db = await this.dbPromise;
    try {
      await db.clear(STORE_NAME);
      logger.info('Offline action queue cleared.');
    } catch (error) {
      logger.error({ error }, 'Failed to clear offline action queue.');
      throw error;
    }
  }
}

// Singleton instance
const offlineQueue = new OfflineQueue();
export default offlineQueue;
