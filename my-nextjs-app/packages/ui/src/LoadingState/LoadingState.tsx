import React from 'react';
import './LoadingState.module.css';

interface LoadingStateProps {
  message?: string;
  'data-testid'?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ 
  message, 
  'data-testid': dataTestId = 'loading-state' 
}) => {
  return (
    <div className="loading-state" data-testid={dataTestId} role="status" aria-live="polite">
      <div className="loading-state__spinner"></div>
      {message && <p className="loading-state__message">{message}</p>}
    </div>
  );
};
