import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del, keys as idbKeys } from 'idb-keyval';
import throttle from 'lodash.throttle';

interface OfflineMutation {
  id: string;
  operationName: string;
  variables: Record<string, unknown>;
  queuedAt: string;
  attempts: number;
  lastError?: string;
  priority?: number;
  dependsOn?: string;
}

// Placeholder for gql tag function (e.g., from @apollo/client)
const gql = (strings: TemplateStringsArray) => strings.join('');

type ProcessQueueClientType = { mutate: (args: { mutation: string; variables: Record<string, unknown> }) => Promise<unknown> };
type ProcessQueueInternalType = (client: ProcessQueueClientType) => Promise<void>;

export class OfflineMutationManager {
  private static instance: OfflineMutationManager; // Singleton instance
  public persister;
  private maxRetries = 5;
  private baseDelay = 1000;
  private maxStorage = 5 * 1024 * 1024; // 5MB
  private listeners: Record<string, Array<(...args: any[]) => void>> = {};

  private throttledProcessQueue: ProcessQueueInternalType;

  private constructor() {
    // Private constructor to enforce singleton pattern
    const storage = {
      getItem: async (key: string) => get(key),
      setItem: async (key: string, value: unknown) => set(key, value),
      removeItem: async (key: string) => del(key),
    };
    this.persister = createAsyncStoragePersister({ storage });
    this.throttledProcessQueue = throttle<ProcessQueueInternalType>(
      this.processQueueInternal,
      100,
      { leading: true }
    );
  }

  public static getInstance(): OfflineMutationManager {
    if (!OfflineMutationManager.instance) {
      OfflineMutationManager.instance = new OfflineMutationManager();
    }
    return OfflineMutationManager.instance;
  }

  public addEventListener(eventName: string, callback: (...args: any[]) => void): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
  }

  public removeEventListener(eventName: string, callback: (...args: any[]) => void): void {
    if (this.listeners[eventName]) {
      this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
    }
  }

  private dispatchEvent(eventName: string, ...args: any[]): void {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach(callback => callback(...args));
    }
  }

  public async getQueueCount(): Promise<number> {
    const allKeys = await idbKeys();
    const mutationKeys = allKeys.filter((k: IDBValidKey) => typeof k === 'string' && k.startsWith('mutation_'));
    return mutationKeys.length;
  }

  public getLastSync(): Date | null {
    // This would require storing the last sync time, which is not currently implemented.
    // For now, return null or a placeholder.
    return null;
  }

  async queueMutation(mutation: Omit<OfflineMutation, 'id' | 'queuedAt' | 'attempts'>, priority: number = 1): Promise<void> {
    const id = crypto.randomUUID();
    const size = JSON.stringify(mutation).length;
    if ((await this.getTotalSize()) + size > this.maxStorage) {
      await this.evictOldest();
    }
    await set(`mutation_${id}`, {
      ...mutation,
      id,
      queuedAt: new Date().toISOString(),
      attempts: 0,
      priority,
    });
    this.dispatchEvent('queueUpdated');
  }

  async processQueue(client: { mutate: (args: { mutation: string; variables: Record<string, unknown> }) => Promise<unknown> }): Promise<void> {
    this.throttledProcessQueue(client);
  }

  private processQueueInternal = async (client: { mutate: (args: { mutation: string; variables: Record<string, unknown> }) => Promise<unknown> }): Promise<void> => {
    const allKeys = await idbKeys();
    const mutationKeys = allKeys.filter((k: IDBValidKey) => typeof k === 'string' && k.startsWith('mutation_')) as string[];
    const mutations = await Promise.all(
      mutationKeys.map((k: string) => get<OfflineMutation>(k))
    );
    const sortedMutations = this.sortWithDependencies(mutations.filter(Boolean) as OfflineMutation[]);
    const batches = [];
    for (let i = 0; i < sortedMutations.length; i += 5) {
      batches.push(sortedMutations.slice(i, i + 5));
    }

    for (const batch of batches) {
      try {
        const results = await Promise.all(
          batch.map(async (mutation) => {
            if (mutation.attempts >= this.maxRetries) {
              await del(`mutation_${mutation.id}`);
              return null;
            }
            const existing = mutationKeys.find((k: string) => k !== `mutation_${mutation.id}` && this.isDuplicate(k, mutation));
            if (existing) {
              await del(`mutation_${mutation.id}`);
              return null;
            }
            return client.mutate({
              mutation: gql`mutation ${mutation.operationName} { placeholderField }`,
              variables: mutation.variables,
            });
          })
        );
        for (const [index, result] of results.entries()) {
          if (result) await del(`mutation_${batch[index].id}`);
        }
        this.dispatchEvent('queueUpdated');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        for (const mutation of batch) {
          await set(`mutation_${mutation.id}`, {
            ...mutation,
            attempts: mutation.attempts + 1,
            lastError: errorMessage,
          });
        }
        const delay = this.baseDelay * Math.pow(2, batch[0].attempts);
        setTimeout(() => this.processQueue(client), delay);
      }
    }
    // After all batches are attempted, check if queue is empty for syncCompleted
    const finalQueueCount = await this.getQueueCount();
    if (finalQueueCount === 0) {
      this.dispatchEvent('syncCompleted');
    }
  }

  private async isDuplicate(key: string, mutation: OfflineMutation): Promise<boolean> {
    const other = await get<OfflineMutation>(key);
    return (
      other?.operationName === mutation.operationName &&
      JSON.stringify(other?.variables) === JSON.stringify(mutation.variables)
    );
  }

  private async getTotalSize(): Promise<number> {
    let size = 0;
    const allKeys = await idbKeys();
    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith('mutation_')) {
        const mutation = await get<OfflineMutation>(key);
        if (mutation) {
          size += JSON.stringify(mutation).length;
        }
      }
    }
    return size;
  }

  private async evictOldest(): Promise<void> {
    const allKeys = await idbKeys();
    const mutationKeys = allKeys.filter((k: IDBValidKey) => typeof k === 'string' && k.startsWith('mutation_')) as string[];
    const mutationsWithKeys = await Promise.all(
      mutationKeys.map(async (key: string) => ({ key, mutation: await get<OfflineMutation>(key) }))
    );

    const validMutations = mutationsWithKeys.filter((item): item is { key: string; mutation: OfflineMutation } => item.mutation !== undefined && item.mutation !== null);

    if (validMutations.length === 0) return;

    const oldestEntry = validMutations.sort((a, b) => {
      const aTime = new Date(a.mutation.queuedAt).getTime();
      const bTime = new Date(b.mutation.queuedAt).getTime();
      return aTime - bTime;
    })[0];

    await del(oldestEntry.key);
  }

  private sortWithDependencies(mutations: OfflineMutation[]): OfflineMutation[] {
    const graph = new Map<string, OfflineMutation[]>();
    const inDegree = new Map<string, number>();

    mutations.forEach((m) => {
      graph.set(m.id, []);
      inDegree.set(m.id, 0);
    });

    mutations.forEach((m) => {
      if (m.dependsOn) {
        graph.get(m.dependsOn)?.push(m);
        inDegree.set(m.id, (inDegree.get(m.id) || 0) + 1);
      }
    });

    const queue: string[] = mutations.filter((m) => !inDegree.get(m.id)).map((m) => m.id);
    const result: OfflineMutation[] = [];

    while (queue.length) {
      const id = queue.shift()!;
      const mutation = mutations.find((m) => m.id === id)!;
      result.push(mutation);
      graph.get(id)?.forEach((dep) => {
        inDegree.set(dep.id, inDegree.get(dep.id)! - 1);
        if (inDegree.get(dep.id) === 0) queue.push(dep.id);
      });
    }

    return result;
  }
}
