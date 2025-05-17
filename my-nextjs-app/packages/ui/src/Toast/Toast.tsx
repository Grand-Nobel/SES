import React from 'react';
import styles from './Toast.module.css';

interface ToastProps {
  message: string;
  type: 'info' | 'success' | 'error';
}

const Toast: React.FC<ToastProps> = ({ message, type }) => {
  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      {message}
    </div>
  );
};

export default Toast;