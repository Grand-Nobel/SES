'use client';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FocusTrap } from './FocusTrap';
import { PrivacyLogger } from '@/lib/logging';
import { OfflineMutationManager } from '@/lib/api/offlineMutationManager';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore'; // Added useAuthStore import
import './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  'data-testid'?: string;
}

const offlineManager = new OfflineMutationManager();

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'medium',
  className = '',
  'data-testid': dataTestId = 'modal',
}) => {
  const modalRef = useRef(null);
  const authStoreHook = useAuthStore(); 

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!navigator.onLine) {
          await offlineManager.queueMutation({
            operationName: 'modalClose',
            variables: { title },
          }, 2);
        }
        const maskedEvent = await PrivacyLogger().maskPersonalData({ title });
        await supabase.from('ui_events').insert({
          tenant_id: authStoreHook.getState().tenantId,
          event: 'modal_close',
          payload: maskedEvent,
        });
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, title, authStoreHook]);

  const handleOverlayClick = async (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      if (!navigator.onLine) {
        await offlineManager.queueMutation({
          operationName: 'modalClose',
          variables: { title },
        }, 2);
      }
      const maskedEvent = await PrivacyLogger().maskPersonalData({ title });
      await supabase.from('ui_events').insert({
        tenant_id: authStoreHook.getState().tenantId,
        event: 'modal_close',
        payload: maskedEvent,
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    
      
        <FocusTrap data-testid={`${dataTestId}-focus-trap`}>
          
            
              {title}
              
                
                  X {/* Placeholder for close icon */}
                
              
            
            
              {children}
            
            {actions && (
              
                {actions}
              
            )}
          
        </FocusTrap>
      
    ,
    document.body
  );
};