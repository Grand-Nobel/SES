// my-nextjs-app/src/lib/api/offlineMutationManager.ts

interface QueuedMutation {
  id: string; // Unique ID for the mutation
  operationName: string;
  variables: any;
  priority?: number;
  timestamp: number;
}

type EventListener = (event?: any) => void;

export class OfflineMutationManager {
  private static instance: OfflineMutationManager;
  private queue: QueuedMutation[] = [];
  private lastSync: Date | null = null;
  private eventListeners: Record<string, EventListener[]> = {};

  // Private constructor for singleton pattern
  private constructor() {
    console.log("OfflineMutationManager initialized");
    // Load queue from storage if available (e.g., IndexedDB)
    this.loadQueueFromStorage();
  }

  public static getInstance(): OfflineMutationManager {
    if (!OfflineMutationManager.instance) {
      OfflineMutationManager.instance = new OfflineMutationManager();
    }
    return OfflineMutationManager.instance;
  }

  private async loadQueueFromStorage() {
    // Placeholder: In a real app, load from IndexedDB or localStorage
    console.log("OfflineMutationManager: Attempting to load queue from storage (mock).");
    if (typeof window !== 'undefined') {
      const storedQueue = localStorage.getItem('offlineMutationQueue');
      if (storedQueue) {
        this.queue = JSON.parse(storedQueue);
        this.emitEvent('queueUpdated');
      }
    }
  }

  private async saveQueueToStorage() {
    // Placeholder: In a real app, save to IndexedDB or localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('offlineMutationQueue', JSON.stringify(this.queue));
    }
  }

  public async queueMutation(
    mutation: { operationName: string; variables: any },
    priority: number = 2 // Default priority
  ): Promise<{ success: boolean; id: string }> {
    const newMutation: QueuedMutation = {
      id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      ...mutation,
      priority,
      timestamp: Date.now(),
    };
    this.queue.push(newMutation);
    this.queue.sort((a, b) => (a.priority || 2) - (b.priority || 2) || a.timestamp - b.timestamp); // Sort by priority, then by time
    await this.saveQueueToStorage();
    this.emitEvent('queueUpdated');
    console.log(`OfflineMutationManager: Queued mutation "${newMutation.operationName}" (ID: ${newMutation.id}). Queue size: ${this.queue.length}`);
    
    // Attempt to process immediately if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.processQueue();
    }
    return { success: true, id: newMutation.id };
  }

  public getQueueCount(): number {
    return this.queue.length;
  }

  public getLastSync(): Date | null {
    return this.lastSync;
  }

  public async processQueue(): Promise<void> {
    if (this.queue.length === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      if (this.queue.length > 0) console.log("OfflineMutationManager: Offline, cannot process queue.");
      return;
    }

    console.log(`OfflineMutationManager: Processing queue of ${this.queue.length} mutations.`);
    const mutationToProcess = this.queue[0]; // Process one by one (FIFO based on current sort)

    try {
      // Placeholder for actual mutation execution (e.g., using fetch or a GraphQL client)
      console.log(`OfflineMutationManager: Executing mutation "${mutationToProcess.operationName}" (ID: ${mutationToProcess.id})`, mutationToProcess.variables);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      // const response = await executeGraphQLMutation(mutationToProcess.operationName, mutationToProcess.variables);
      // if (!response.ok) throw new Error(`Mutation failed: ${response.statusText}`);
      
      console.log(`OfflineMutationManager: Mutation "${mutationToProcess.operationName}" (ID: ${mutationToProcess.id}) successful.`);
      this.queue.shift(); // Remove from queue on success
      this.lastSync = new Date();
      await this.saveQueueToStorage();
      this.emitEvent('queueUpdated');
      this.emitEvent('syncCompleted', { success: true, mutationId: mutationToProcess.id });

      // Process next item if any
      if (this.queue.length > 0) {
        this.processQueue(); // Recursive call for next item
      }
    } catch (error) {
      console.error(`OfflineMutationManager: Failed to process mutation "${mutationToProcess.operationName}" (ID: ${mutationToProcess.id}):`, error);
      // Handle error: e.g., move to a failed queue, retry logic, notify user
      this.emitEvent('syncCompleted', { success: false, mutationId: mutationToProcess.id, error });
      // For simplicity, we don't remove it here, so it might be retried next time processQueue is called.
      // Or implement a retry limit / backoff strategy.
    }
  }

  public addEventListener(eventName: string, listener: EventListener): void {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(listener);
  }

  public removeEventListener(eventName: string, listener: EventListener): void {
    if (!this.eventListeners[eventName]) return;
    this.eventListeners[eventName] = this.eventListeners[eventName].filter(l => l !== listener);
  }

  private emitEvent(eventName: string, data?: any): void {
    if (!this.eventListeners[eventName]) return;
    this.eventListeners[eventName].forEach(listener => listener(data));
  }
}
