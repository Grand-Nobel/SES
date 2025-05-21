'use client';
import React, { useState, useEffect } from 'react';
import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import { agentRunner } from '@/lib/agents';
import { useAuthStore } from '@/stores/authStore';
import './AiSuggestedActions.module.css';

interface SuggestedAction {
  id: string;
  label: string;
  onClick: () => void;
}

interface AiSuggestedActionsProps {
  maxVisible?: number;
  staggerDelay?: number;
  suggestedActions?: SuggestedAction[]; // Made this prop optional as per SEED doc logic
  'data-testid'?: string;
}

const AiSuggestedActions: React.FC<AiSuggestedActionsProps> = ({
  maxVisible = 3,
  staggerDelay = 500,
  suggestedActions: initialSuggestedActions = [],
  'data-testid': dataTestId = 'ai-suggested-actions',
}) => {
  const { tenantId } = useAuthStore();
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>(initialSuggestedActions);
  const [visibleActions, setVisibleActions] = useState<string[]>([]);

  useEffect(() => {
    if (!suggestedActions.length && !initialSuggestedActions.length) {
      agentRunner.run({
        agentName: 'ActionSuggester',
        action: 'suggestActions',
        payload: { tenantId },
        cache: { key: `actions:${tenantId}`, ttl: 3600 },
      }).then((response: any) => {
        setSuggestedActions(response.actions || []);
      });
    }
  }, [tenantId, suggestedActions, initialSuggestedActions]);

  useEffect(() => {
    const logSuggestions = async () => {
      const maskedEvent = await PrivacyLogger().maskPersonalData({ actions: suggestedActions.map((a) => a.label) });
      await supabase.from('ui_events').insert({
        tenant_id: tenantId,
        event: 'ai_suggestions_render',
        payload: maskedEvent,
      });
    };
    if (suggestedActions.length > 0) {
        logSuggestions();
    }

    setVisibleActions([]);
    const displayedActions = suggestedActions.slice(0, maxVisible);
    displayedActions.forEach((action: SuggestedAction, index: number) => { // Added types
      setTimeout(() => {
        setVisibleActions((prev) => [...prev, action.id]);
      }, index * staggerDelay);
    });
  }, [suggestedActions, maxVisible, staggerDelay, tenantId]);

  return (
    <div className={styles.container} data-testid={dataTestId}>
      {suggestedActions.slice(0, maxVisible).map((action: SuggestedAction) => (
        <button
          key={action.id}
          className={styles.actionButton}
          onClick={action.onClick}
          aria-label={action.label} // Added aria-label for accessibility
        >
          {action.label}
        </button>
      ))}
      {suggestedActions.length > maxVisible && (
        <span className={styles.moreActions}>
          +{suggestedActions.length - maxVisible} more
        </span>
      )}
    </div>
  );
};

export default AiSuggestedActions;
