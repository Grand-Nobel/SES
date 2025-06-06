import React from 'react';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`
      bg-surface
      rounded-lg
      shadow-md
      p-6
      border border-[rgba(224,224,255,0.1)]
      ${className || ''}
    `}>
      {children}
    </div>
  )
}
