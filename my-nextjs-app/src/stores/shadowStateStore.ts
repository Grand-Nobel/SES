import { create } from 'zustand';
// import debounce from 'lodash.debounce'; // Commented out due to type resolution issues

import { AgentUIAction } from '@/types/agent';

interface ShadowState {
  isShadowModeActive: boolean;
  pendingShadowActions: AgentUIAction[];
  activeShadowVisualization: { actionId: string; uiTarget: string; proposedChanges: Record<string, unknown> } | null; // Changed any to Record<string, unknown>
  isPaused: boolean;
  toggleShadowMode: (active: boolean) => void;
  queueShadowAction: (action: AgentUIAction) => void;
  clearShadowAction: (actionId: string) => void;
  setActiveVisualization: (visualization: ShadowState['activeShadowVisualization']) => void;
  pauseAgentActions: () => void;
  resumeAgentActions: () => void;
  resolveConflictingActions: (actions: AgentUIAction[]) => AgentUIAction | null;
}

export const useShadowStateStore = create<ShadowState>((set, get) => ({
  isShadowModeActive: false,
  pendingShadowActions: [],
  activeShadowVisualization: null,
  isPaused: false,
  toggleShadowMode: (active) => set({ isShadowModeActive: active }),
  queueShadowAction: (action) => {
    if (get().isPaused) return;
    set((state) => {
      const conflicting = state.pendingShadowActions.filter((a) => a.target === action.target && a.type === action.type);
      if (conflicting.length > 0) {
        const resolved = get().resolveConflictingActions([...conflicting, action]);
        // Ensure resolved action is not null before adding
        if (resolved) {
          return {
            pendingShadowActions: [
              ...state.pendingShadowActions.filter((a) => a.target !== action.target || a.type !== action.type),
              resolved,
            ].slice(-10),
          };
        }
      }
      return { pendingShadowActions: [...state.pendingShadowActions, action].slice(-10) };
    });
  },
  clearShadowAction: (actionId) =>
    set((state) => ({
      pendingShadowActions: state.pendingShadowActions.filter((a) => a.actionId !== actionId),
    })),
  setActiveVisualization: (visualization) => set({ activeShadowVisualization: visualization }),
  pauseAgentActions: () => set({ isPaused: true }),
  // resumeAgentActions: debounce(() => set({ isPaused: false }), 5000), // Commented out due to type resolution issues
  resumeAgentActions: () => set({ isPaused: false }), // Replaced with non-debounced version
  resolveConflictingActions: (actions) => {
    return actions.reduce((highest, action) => (
      action.confidence > highest.confidence ? action : highest
    ), actions[0]);
  },
}));
