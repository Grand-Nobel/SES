import { atom, useAtom } from 'jotai';

import { AgentUIAction } from '@/types/agent';

export const agentActionAtom = atom<AgentUIAction[]>([]);
export const isShadowModeAtom = atom(false);

export const useAgentState = () => {
  const [actions, setActions] = useAtom(agentActionAtom);
  const [isShadowMode, setShadowMode] = useAtom(isShadowModeAtom);

  const queueAction = (action: AgentUIAction) => {
    setActions((prev: AgentUIAction[]) => [...prev, action].slice(-10));
  };

  return { actions, isShadowMode, setShadowMode, queueAction };
};
