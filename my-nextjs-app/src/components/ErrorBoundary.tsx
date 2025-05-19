'use client';
import React from 'react';
import { captureMessage } from '@sentry/nextjs'; // Assuming @sentry/nextjs is or will be installed

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode; // Optional fallback UI
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    // Example: Log to Sentry
    if (typeof captureMessage === 'function') {
      captureMessage('Rendering error caught by ErrorBoundary', {
        extra: {
          error: error.message,
          componentStack: errorInfo.componentStack,
        },
        level: 'error',
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div role="alert" style={{ padding: '20px', border: '1px solid red', margin: '20px' }}>
          <h2>Something went wrong.</h2>
          <p>We're sorry for the inconvenience. Please try refreshing the page.</p>
          {this.state.error && (
            <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
              <summary>Error Details</summary>
              {this.state.error.toString()}
              <br />
              {/* In development, you might want to show the stack or componentStack */}
              {/* {process.env.NODE_ENV === 'development' && this.state.error.stack} */}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// It's common to also export a functional component wrapper if needed,
// or just use the class component directly.
export default ErrorBoundary;