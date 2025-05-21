'use client';
import React from 'react';
import { useUIStore } from '@/stores/uiStore';
import styles from './Backdrop.module.css';

interface BackdropProps {
  onClick?: () => void;
}

export const Backdrop: React.FC<BackdropProps> = ({ onClick }) => {
  const { isMobileMenuOpen, toggleMobileMenu } = useUIStore();

  if (!isMobileMenuOpen) {
    return null;
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      toggleMobileMenu(); // Default action if no onClick is provided
    }
  };

  return (
    <div
      className={styles.backdrop}
      onClick={handleClick}
      aria-hidden="true" // Usually, a backdrop is decorative or for click-off
    />
  );
};
