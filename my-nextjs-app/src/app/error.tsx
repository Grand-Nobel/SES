'use client'; // Error boundaries must be Client Components

import React from 'react'; // Added React import

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error("Segment Error:", error);
  }, [error]);

  return (
    <React.Fragment>
      
        <h2>Something went wrong in this segment!</h2>
        <button
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => reset()
          }
        >
          Try again
        </button>
      
    </React.Fragment>
  );
}
