// src/types/agent.ts
export interface AgentUIAction {
  actionId: string;
  type: string; // e.g., 'OPEN_MODAL' | 'NAVIGATE' | 'UPDATE_STATE' | 'FORM_PREFILL' | 'LAYOUT_ADAPT';
  target: string;
  payload: Record<string, unknown>; // Changed any to Record<string, unknown>
  confidence: number;
  metadata?: { agentName: string; traceId: string; urgency?: string; jwt: string; timestamp: string };
  proofOfAction: string;
}

export interface AgentMetadata {
  agentName: string;
  traceId: string;
  urgency?: string;
  jwt: string;
  timestamp: string;
}
