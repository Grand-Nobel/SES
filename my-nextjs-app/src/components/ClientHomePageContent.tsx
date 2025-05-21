'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const AiChatPrototype = dynamic(() => import('../prototypes/AiChatPrototype'), {
  ssr: false,
  loading: () => null, // Or a loading state
});

const ClientHomePageContent: React.FC = () => {
  return (
    <section className="w-full max-w-4xl">
      <h2 className="text-2xl font-semibold mb-4">AI Chat Prototype</h2>
      <div style={{ border: '1px solid #eee', padding: '1rem', borderRadius: '8px', height: '500px', backgroundColor: '#f9f9f9' }}>
        <AiChatPrototype initialSuggestions={['Hello AI', 'What can you do?']} />
      </div>
    </section>
  );
};

export default ClientHomePageContent;