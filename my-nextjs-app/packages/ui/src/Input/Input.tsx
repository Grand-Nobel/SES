// packages/ui/src/Input/Input.tsx
'use client';
import React from 'react';
import styles from './Input.module.css'; // Assuming you'll create this CSS module

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // You can add specific props here if needed, e.g., label, error messages
  'data-testid'?: string;
}

export const Input: React.FC<InputProps> = ({ className, ...props }) => {
  return (
    <input
      className={`${styles.customInput} ${className || ''}`}
      {...props}
    />
  );
};

// If it's a default export in the original codebase:
// export default Input; 
// However, the import in DashboardBuilder was `import { Input } ...` suggesting a named export.
