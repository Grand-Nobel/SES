// This file is for Sync-specific type definitions beyond what Yjs provides.
// It can be populated as the SyncFramework integration evolves.

/**
 * Example: Defines the structure for a sync operation's metadata.
 */
export interface SyncOperationMetadata {
  operationId: string;
  timestamp: Date;
  source: string; // e.g., 'local_client', 'remote_server_X'
  targetConnectorId?: string;
}

/**
 * Example: Defines the structure for a sync conflict if manual resolution is ever needed.
 * Yjs typically handles conflicts automatically.
 */
export interface SyncConflict {
  conflictId: string;
  path: string; // Path to the conflicting data within the Yjs document
  localValue: any;
  remoteValue: any;
  resolvedValue?: any;
  resolutionStrategy?: 'local_wins' | 'remote_wins' | 'manual';
}

// Add other sync-related types here as needed.