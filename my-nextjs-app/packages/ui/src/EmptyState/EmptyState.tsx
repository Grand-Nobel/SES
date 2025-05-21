import React from 'react';
import './EmptyState.module.css';

interface EmptyStateProps {
  message: string;
  'data-testid'?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, 'data-testid': dataTestId = 'empty-state' }) => {
  return (
    <React.Fragment>
      
        {message}
      
    </React.Fragment>
  );
};
