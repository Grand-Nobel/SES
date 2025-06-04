import * as Y from 'yjs';
import { supabase } from './supabase';
import * as Sentry from '@sentry/react';
import { createHash } from 'crypto';

import { AgentUIAction } from '@/types/agent';

function generateProofOfAction(action: Omit<AgentUIAction, 'proofOfAction'>): string {
  const payload = JSON.stringify({
    type: action.type,
    target: action.target,
    payload: action.payload,
    metadata: action.metadata,
  });
  return createHash('sha256').update(payload).digest('hex');
}

function verifyAgentAction(action: AgentUIAction): boolean {
  const ttl = 5 * 60 * 1000;
  const now = Date.now();
  const timestamp = action.metadata?.timestamp ? new Date(action.metadata.timestamp).getTime() : 0; // Handle undefined timestamp
  if (timestamp === 0 || now - timestamp > ttl) return false;
  const expectedProof = generateProofOfAction({
    actionId: action.actionId, // Added missing property
    type: action.type,
    target: action.target,
    payload: action.payload,
    confidence: action.confidence, // Added missing property
    metadata: action.metadata,
  });
  // Placeholder for actual JWT verification
  const verifyJwt = (jwt?: string) => {
    if (!jwt) return false;
    // In a real application, this would involve verifying the JWT signature and claims.
    // For now, we'll just assume it's valid if present.
    return true;
  };
  return action.proofOfAction === expectedProof && verifyJwt(action.metadata?.jwt);
}

const doc = new Y.Doc();

function mergeCrdt(localState: Record<string, unknown>, serverState: Record<string, unknown>): Record<string, unknown> { // Changed any to Record<string, unknown>
  // This is a simplified merge. A real CRDT merge would be more complex.
  return { ...localState, ...serverState };
}

function updateLocalState(newState: Record<string, unknown>) { // Changed any to Record<string, unknown>
  // Placeholder for updating local state (e.g., Zustand store, React state)
  console.log('Updating local state with:', newState);
}

function showConflictResolver(conflict: { local: Record<string, unknown>; server: Record<string, unknown>; timestamp: string }) { // Changed any to Record<string, unknown>
  // Placeholder for showing a UI to resolve conflicts
  console.warn('Conflict detected, showing resolver:', conflict);
}

// Placeholder for rateLimiter
const rateLimiter = {
  consume: async (_id: string) => { // id is unused, prefixed with _
    // Simulate rate limiting
    return new Promise(resolve => setTimeout(resolve, 10));
  }
};

export function subscribeToAgentActions(tenantId: string, callback: (action: AgentUIAction) => void): () => void {
  const subscription = supabase
    .channel(`tenant:${tenantId}:agent-ui`)
    .on('broadcast', { event: 'ui_action' }, async ({ payload }: { payload: AgentUIAction }) => { // Added type for payload
      try {
        if (payload.metadata?.traceId) { // Check if traceId exists before consuming
          await rateLimiter.consume(payload.metadata.traceId);
        }
        if (!verifyAgentAction(payload)) throw new Error('Invalid action');
        callback(payload); // No need to cast if payload is typed
      } catch (error) {
        Sentry.captureException(error);
      }
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

export function subscribeToCriticalData(tenantId: string, callback: (state: Record<string, unknown>) => void) { // Changed any to Record<string, unknown>
  supabase
    .channel(`tenant:${tenantId}:critical-data`)
    .on('broadcast', { event: 'state_update' }, ({ payload }: { payload: { timestamp: string; isCritical: boolean; crdtUpdate: Uint8Array } }) => { // Added type for payload
      handleWebSocketUpdate(payload, doc.getMap('state').toJSON() as Record<string, unknown>); // Cast toJSON() result
      callback(doc.getMap('state').toJSON() as Record<string, unknown>); // Cast toJSON() result
    })
    .subscribe();
}

function handleWebSocketUpdate(update: { timestamp: string; isCritical: boolean; crdtUpdate: Uint8Array }, localState: Record<string, unknown> & { timestamp?: string }) { // Changed any to Record<string, unknown> and added specific type for update
  const serverTimestamp = new Date(update.timestamp).getTime();
  const localTimestamp = localState.timestamp ? new Date(localState.timestamp).getTime() : 0; // Handle potentially undefined localState.timestamp

  if (update.isCritical) {
    Y.applyUpdate(doc, update.crdtUpdate);
    const mergedState = doc.getMap('state').toJSON();
    updateLocalState(mergedState);
  } else if (serverTimestamp > localTimestamp) {
    updateLocalState(update);
  } else if (serverTimestamp === localTimestamp) {
    const merged = mergeCrdt(localState, update);
    updateLocalState(merged);
  } else {
    Sentry.captureMessage('WebSocket conflict detected', { extra: { update, localState } });
    showConflictResolver({ local: localState, server: update, timestamp: update.timestamp });
  }
}
