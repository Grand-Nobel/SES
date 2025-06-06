'use client'; // Error boundaries must be Client Components

import React from 'react'; // Added React import

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error:", error);
  }, [error]);

  return (
    // global-error must include html and body tags
    <html>
      <body>
        <h2>Something went wrong globally!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
