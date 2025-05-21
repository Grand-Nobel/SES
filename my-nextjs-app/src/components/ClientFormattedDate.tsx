'use client';

import { useState, useEffect } from 'react';

interface ClientFormattedDateProps {
  dateString?: string;
  options?: Intl.DateTimeFormatOptions;
}

export default function ClientFormattedDate({ dateString, options }: ClientFormattedDateProps) {
  const [formattedDate, setFormattedDate] = useState<string | null>(null);

  useEffect(() => {
    if (dateString) {
      try {
        const date = new Date(dateString);
        // Default options if none provided
        const defaultOptions: Intl.DateTimeFormatOptions = {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true,
        };
        setFormattedDate(date.toLocaleString(undefined, options || defaultOptions));
      } catch (e) {
        console.error("Error formatting date:", e);
        setFormattedDate(dateString); // Fallback to original string on error
      }
    } else {
      setFormattedDate('N/A'); // Or some other placeholder
    }
  }, [dateString, options]);

  // Render a placeholder or null during server render / initial client render before useEffect runs
  // This ensures server and client initial render match for this part.
  if (formattedDate === null && typeof window === 'undefined') {
    // For SSR, you might want to render the raw string or a placeholder if an immediate value is needed,
    // but for hydration safety, deferring to client-side formatting is best.
    // Or, if you pass a pre-formatted UTC string from server, that could be rendered directly.
    // For now, rendering null initially on server and letting client fill it.
    return null;
  }
  
  // On the client, before useEffect runs, formattedDate is null.
  // To match the server's initial null render, we also return null here initially.
  // The useEffect will then update formattedDate and trigger a re-render.
  return <>{formattedDate}</>;
}