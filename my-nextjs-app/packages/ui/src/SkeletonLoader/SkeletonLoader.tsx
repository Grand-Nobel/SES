import React from 'react';
import styles from './SkeletonLoader.module.css';

interface SkeletonLoaderProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  borderRadius?: string; // e.g., 'var(--radius-2)'
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  borderRadius,
}) => {
  const style = {
    width,
    height,
    borderRadius: borderRadius || undefined, // Use token or default
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={true}
      className={`${styles.skeletonLoader} ${className}`}
      style={style}
    >
      <span className={styles.visuallyHidden}>Loading...</span>
    </div>
  );
};

// Optional: For preset shapes, if decided to implement now or later
// SkeletonLoader.Circle = ({ size, className }: { size: string | number; className?: string }) => (
//   <SkeletonLoader width={size} height={size} borderRadius="50%" className={className} />
// );
