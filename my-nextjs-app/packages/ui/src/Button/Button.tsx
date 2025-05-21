'use client';
import React from 'react';
import './Button.module.css';
import { PrivacyLogger } from '@/lib/logging';

// Extend standard button attributes to include disabled, style, etc.
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  // onClick, children, className, disabled, style, aria-label are inherited
  'data-testid'?: string; // Keep custom data-testid if needed
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  loading = false,
  onClick,
  children,
  className, // from ButtonHTMLAttributes
  disabled,  // from ButtonHTMLAttributes
  style,     // from ButtonHTMLAttributes
  'aria-label': ariaLabel, // Explicitly handle if needed, or let ...rest pass it
  'data-testid': dataTestId = 'button',
  ...rest // Capture other standard button props
}) => {
  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // If the button is programmatically disabled or in loading state, do nothing.
    // The `disabled` attribute on the button element itself will prevent most clicks,
    // but this is an extra safeguard.
    if (disabled || loading) {
      event.preventDefault(); // Prevent any default action if somehow clicked
      return;
    }

    if (onClick) {
      onClick(event); // Pass the event to the provided onClick handler
    }

    // Logging (optional, consider if this should be responsibility of consumer)
    try {
      const logger = PrivacyLogger();
      await logger.log('buttonClick', { 
        buttonId: dataTestId, 
        context: ariaLabel || (typeof children === 'string' ? children : 'button') 
      });
    } catch (error) {
      console.error('Button click logging failed:', error);
    }
  };

  return (
    <button
      className={`button button--${variant} ${loading ? 'button--loading' : ''} ${className || ''}`}
      onClick={handleClick}
      disabled={disabled || loading} // Actual disabled state
      aria-label={ariaLabel} // Ensure aria-label is passed
      data-testid={dataTestId}
      style={style}
      {...rest} // Pass down other native button props
    >
      {loading && <div className="button__spinner" data-testid={`${dataTestId}-spinner`}></div>}
      {/* It's common to wrap children in a span for better styling control if needed */}
      <span className="button__text">{children}</span>
    </button>
  );
};

export default Button;
