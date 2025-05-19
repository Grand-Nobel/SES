import Link from 'next/link';
import React from 'react'; // Added React import

export default function NotFound() {
  return (
    <React.Fragment>
      
        <h2>Not Found</h2>
        <p>Could not find the requested resource.</p>
        <Link href="/">Return Home</Link>
      
    </React.Fragment>
  );
}