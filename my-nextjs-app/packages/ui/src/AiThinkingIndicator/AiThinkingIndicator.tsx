'use client';
import React, { useState, useEffect } from 'react';
import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore'; // Added useAuthStore import
// import { Icon } from '@/components/Icon'; // Icon component not yet created, will use placeholder
import './AiThinkingIndicator.module.css';

interface AiThinkingIndicatorProps {
  steps?: string[];
  isVisible?: boolean;
  'data-testid'?: string;
}

const AiThinkingIndicator: React.FC<AiThinkingIndicatorProps> = ({
  steps = [],
  isVisible = true,
  'data-testid': dataTestId = 'ai-thinking-indicator',
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const authStoreHook = useAuthStore();

  useEffect(() => {
    if (!isVisible || steps.length === 0) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 2000);

    const logIndicator = async () => {
      const maskedEvent = await PrivacyLogger().maskPersonalData({ message: 'Thinking...', isVisible });
      await supabase.from('ui_events').insert({
        tenant_id: authStoreHook.tenantId,
        event: 'ai_thinking_render',
        payload: maskedEvent,
      });
    };
    logIndicator();

    return () => clearInterval(interval);
  }, [isVisible, steps, authStoreHook]);

  if (!isVisible) return null;

  return (
    <div className="ai-thinking" data-testid={dataTestId}>
      <div className="ai-thinking__icon">
        {/* Placeholder for Icon component */}
        {/* <Icon name="ai-thinking-dots" /> */}
        <div className="ai-thinking__dots-placeholder">...</div>
      </div>
      
      {steps.length > 0 && (
        <div className="ai-thinking__steps">
          {/* Placeholder for Icon component */}
          {/* <Icon name="step-icon" /> */}
          <span>{steps[currentStep]}</span>
        </div>
      )}
    </div>
  );
};

export default AiThinkingIndicator;
