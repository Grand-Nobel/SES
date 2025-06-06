'use client'; // Error components must be Client Components

import React, { useEffect } from 'react';
import { captureMessage } from '@sentry/nextjs';

interface ErrorProps {
  error: Error & { digest?: string }; // Next.js may add a digest
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Dashboard error caught:", error);
    if (typeof captureMessage === 'function') {
      captureMessage('Dashboard error boundary triggered', {
        extra: { 
          errorMessage: error.message,
          errorStack: error.stack,
          errorDigest: error.digest 
        },
        level: 'error',
      });
    }
  }, [error]);

  return (
    <div className="error-page" style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Something went wrong on the Dashboard</h1>
      <p>{error.message || 'An unexpected error occurred.'}</p>
      {error.digest && <p><small>Digest: {error.digest}</small></p>}
      <button 
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
        style={{
          padding: '10px 20px',
          marginTop: '20px',
          cursor: 'pointer',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px'
        }}
      >
        Try again
      </button>
    </div>
  );
}
