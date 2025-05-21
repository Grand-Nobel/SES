'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore'; // Adjusted path
import { agentRunner } from '../lib/agents'; // Adjusted path
import { PrivacyLogger } from '../lib/logging'; // Adjusted path
import { supabase } from '../lib/supabase'; // Adjusted path
import * as tf from '@tensorflow/tfjs'; // Ensure @tensorflow/tfjs is installed
// import './ShortcutRecommender.module.css'; // CSS Module path from outline
// Assuming CSS will be created at src/components/ShortcutRecommender.module.css

interface ShortcutRecommenderProps {
  position: 'sidebar' | 'topbar'; // As used in dashboard/page.tsx
  'data-testid'?: string;
}

const ShortcutRecommender: React.FC<ShortcutRecommenderProps> = ({ // Added Props
  position,
  'data-testid': dataTestId = 'shortcut-recommender',
}) => {
  const { t } = useTranslation('shortcuts');
  const authStore = useAuthStore.getState(); // Get static state for initial values if needed
  const tenantId = authStore.tenantId;
  const user = authStore.user;
  
  const [shortcuts, setShortcuts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    async function loadModelAndPredict() {
      if (!isOnline) {
        setShortcuts([]);
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        // Ensure the model URL is correct and accessible
        const model = await tf.loadLayersModel('https://cdn.ses.com/models/shortcut-model/model.json'); // Placeholder URL
        
        // fetchUserBehavior should ideally get some real user data
        const userBehavior = await fetchUserBehavior(user?.id, tenantId); 
        const prediction = model.predict(tf.tensor(userBehavior)) as tf.Tensor;
        const shortcutIndices = prediction.argMax(-1).dataSync(); // tf.DataSync is ArrayLike<number>
        
        const predictedShortcuts = mapIndicesToShortcuts(shortcutIndices as unknown as number[]); // Cast to number[]

        setShortcuts(predictedShortcuts);
        const logger = PrivacyLogger();
        const maskedEvent = await logger.maskPersonalData({ // Use logger instance
          tenantId,
          userId: user?.id,
          shortcuts: predictedShortcuts,
        });
        await supabase.from('system_metrics').insert({
          tenant_id: tenantId,
          metric: 'shortcut_predicted',
          value: maskedEvent,
        });

        await agentRunner.run({
          agentName: 'TrainingDataCollector',
          action: 'logInteraction',
          payload: { tenantId, userId: user?.id, predictedShortcuts, userBehavior },
        });
      } catch (error) {
        console.error('Shortcut prediction failed:', error);
        // Fallback shortcuts on error
        setShortcuts(['Dashboard', 'Analytics', 'Settings']); 
      } finally {
        setIsLoading(false);
      }
    }

    if (tenantId && user) {
      loadModelAndPredict();
    } else {
      setIsLoading(false); // Not enough data to predict
      setShortcuts([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, user?.id, isOnline]); // Depend on user.id for re-fetch if user changes

  const mapIndicesToShortcuts = (indices: number[]): string[] => {
    // This map should correspond to the output layer of your model
    const shortcutMap = ['Dashboard', 'Analytics', 'Notifications', 'Settings', 'Profile', 'Theme'];
    return indices.map((index) => shortcutMap[index] || 'Dashboard'); // Fallback to 'Dashboard'
  };

  // Placeholder for user behavior fetching logic
  const fetchUserBehavior = async (userId?: string, tenantId?: string | null): Promise<number[][]> => {
    // In a real app, fetch historical user interaction data
    // For this placeholder, returning a fixed tensor shape [1, num_features]
    // The number of features must match the model's expected input shape.
    console.log('Fetching user behavior for:', userId, tenantId);
    return [[0.5, 0.3, 0.1, 0.1, 0.05, 0.05]]; // Example: [1, 6 features]
  };

  if (isLoading) {
    return <div data-testid={`${dataTestId}-loading`} className="shortcut-recommender-loading">Loading recommended shortcuts...</div>;
  }

  if (!isOnline) {
    return <div data-testid={`${dataTestId}-offline`} className="offline-message">{t('offline_message', 'Shortcuts unavailable offline')}</div>;
  }

  if (shortcuts.length === 0) {
    return null; // Or a message like "No shortcuts to recommend"
  }

  return (
    <div className={`shortcut-recommender shortcut-recommender--${position}`} data-testid={dataTestId}>
      <h4>{t('recommended_shortcuts', 'Recommended Shortcuts')}</h4>
      <ul>
        {shortcuts.map((shortcut, index) => (
          <li key={index}>
            {/* In a real app, these would be links or buttons */}
            <a href={`/${shortcut.toLowerCase()}`} data-testid={`${dataTestId}-link-${index}`}>{shortcut}</a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ShortcutRecommender; // Changed to default export to match dynamic import in dashboard
