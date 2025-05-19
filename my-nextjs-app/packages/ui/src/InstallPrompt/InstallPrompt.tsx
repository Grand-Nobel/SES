'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // Assuming react-i18next is used and configured
// import { Button, Modal } from '@/packages/ui/src'; // Assuming Button and Modal are available from a central export
// For now, let's use placeholder Button and Modal or assume they are globally available
// If Button and Modal are in specific files, adjust the import path.
// Example: import Button from '../Button/Button';
// Example: import Modal from '../Modal/Modal';
import './InstallPrompt.module.css';

// Placeholder for Modal and Button if not imported from a central UI package
const Modal: React.FC<any> = ({ children, isOpen, onClose, title, ...props }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-placeholder" {...props}>
      <div className="modal-content-placeholder">
        <h2>{title}</h2>
        {children}
        <button onClick={onClose} style={{ marginTop: '10px' }}>Close Modal</button>
      </div>
    </div>
  );
};

const Button: React.FC<any> = ({ children, onClick, ...props }) => {
  return <button onClick={onClick} {...props}>{children}</button>;
};


const InstallPrompt: React.FC = () => {
  const { t } = useTranslation('install'); // Namespace for translations
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false); // Changed to showPromptModal for clarity
  const [visitCount, setVisitCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const visits = parseInt(localStorage.getItem('visitCount') || '0', 10);
      setVisitCount(visits + 1);
      localStorage.setItem('visitCount', (visits + 1).toString());

      // Show prompt based on visit count, e.g., after 3 visits
      // This logic is from the outline, can be adjusted.
      if (visits >= 2) { // Changed to 2 for easier testing (3rd visit)
         // setShowPromptModal(true); // This might be too aggressive, let beforeinstallprompt handle it primarily
      }
    }

    const handler = (e: Event) => {
      e.preventDefault(); // Prevent the mini-infobar from appearing on mobile
      setDeferredPrompt(e);
      setShowPromptModal(true); // Show our custom modal
      console.log('beforeinstallprompt event fired and captured.');
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('Deferred prompt not available.');
      return;
    }
    setShowPromptModal(false); // Hide our custom modal
    (deferredPrompt as any).prompt(); // Show the browser install prompt
    
    const { outcome } = await (deferredPrompt as any).userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    if (outcome === 'accepted') {
      console.log('User accepted the A2HS prompt');
    } else {
      console.log('User dismissed the A2HS prompt');
    }
    setDeferredPrompt(null); // We've used the prompt, and can't use it again.
  };

  const handleDismissClick = () => {
    setShowPromptModal(false);
    setDeferredPrompt(null); // Dismissing means we won't show it again this session from this event
    console.log('User dismissed the custom install prompt.');
  };

  // Do not render the modal if the event hasn't been captured yet or if it's already dismissed
  if (!showPromptModal || !deferredPrompt) {
    return null;
  }

  return (
    <Modal
      isOpen={showPromptModal}
      onClose={handleDismissClick} // Or handleInstallClick if preferred on modal close
      title={t('install_title', 'Install Our App!')} // Default title
      data-testid="install-prompt-modal"
    >
      <p>{t('install_message', 'Get the best experience by installing our app to your home screen.')}</p>
      <div className="install-prompt-actions">
        <Button onClick={handleInstallClick} data-testid="install-app-button" className="button--primary">
          {t('install_button', 'Install App')}
        </Button>
        <Button onClick={handleDismissClick} data-testid="dismiss-install-button" className="button--secondary">
          {t('dismiss_button', 'Not Now')}
        </Button>
      </div>
    </Modal>
  );
};

export default InstallPrompt;