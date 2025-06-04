'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
// Assuming Toast and Button components will be created or paths adjusted
import Button from '../../../packages/ui/src/Button/Button'; 
// import Toast from '../../../packages/ui/src/Toast/Toast'; // Placeholder, will create later if needed
import { useAuthStore } from '../../stores/authStore';
import { PrivacyLogger } from '../../lib/logging';
import { supabase } from '../../lib/supabase';
import { captureMessage } from '@sentry/nextjs';
import { ScreenReaderAnnouncer } from '../../../packages/ui/src/ScreenReaderAnnouncer/ScreenReaderAnnouncer';
import './notifications.module.css';

// Placeholder Toast component if not available
const Toast: React.FC<{ type: string; message: string; onClose?: () => void }> = ({ type, message, onClose }) => (
  <div className={`toast toast--${type}`} role="alert">
    <p>{message}</p>
    {onClose && <button onClick={onClose} aria-label="Close notification">&times;</button>}
  </div>
);


interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

// Adapting to a Client Component structure
const NotificationsContent: React.FC = () => {
  const { t } = useTranslation('notifications');
  const authTenantId = useAuthStore(state => state.tenantId); // Reactive state
  const authUser = useAuthStore(state => state.user); // Reactive state
  const logger = PrivacyLogger();
  const announcer = ScreenReaderAnnouncer.getInstance();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      if (!authTenantId) {
        setIsLoading(false); // Not logged in or no tenant, can't fetch
        return;
      }
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, message, type')
          .eq('tenant_id', authTenantId)
          .order('created_at', { ascending: false }); // Example ordering

        if (error) throw error;
        setNotifications(data || []);
        announcer.announce(t('aria.notifications_loaded', 'Notifications loaded'), authTenantId, false);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        captureMessage('Failed to fetch notifications', { extra: { error, tenantId: authTenantId } });
        setNotifications([]); // Clear notifications on error
      } finally {
        setIsLoading(false);
      }
    }
    fetchNotifications();
  }, [authTenantId, t, announcer]); // Re-fetch if tenantId changes

  const handleAddNotification = async () => {
    if (!authTenantId) {
      console.warn("Cannot add notification without tenantId");
      return;
    }
    const newNotificationData = { 
      message: t('new_notification', 'This is a new notification!'), 
      type: 'info' as const 
    };
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({ 
          tenant_id: authTenantId, 
          message: newNotificationData.message, 
          type: newNotificationData.type 
        })
        .select()
        .single();
      
      if (error) throw error;
      if (data) {
        setNotifications(prev => [data as Notification, ...prev]); // Add to top
        const maskedEvent = await logger.maskPersonalData({ 
          tenantId: authTenantId, 
          userId: authUser?.id, 
          notificationId: data.id 
        });
        await supabase.from('system_metrics').insert({
          tenant_id: authTenantId,
          metric: 'notification_added',
          value: maskedEvent as unknown as Record<string, unknown>, // More specific than any
        });
        announcer.announce(t('aria.notification_added', 'New notification added'), authTenantId, true);
      }
    } catch (error) {
      console.error('Failed to add notification:', error);
      captureMessage('Failed to add notification', { extra: { error, tenantId: authTenantId } });
    }
  };
  
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    // Optionally, delete from backend:
    // supabase.from('notifications').delete().match({ id });
  };


  if (isLoading) {
    return <div data-testid="notifications-loading">Loading notifications...</div>;
  }

  return (
    <div // Changed main to div as this is page.tsx
      className="ses-notifications"
      aria-label={t('aria.notifications_page', 'Notifications Page')}
      tabIndex={-1} 
    >
      <header className="ses-header">
        <h1>{t('title', 'Notifications')}</h1>
        <Button onClick={handleAddNotification} aria-label={t('aria.add_notification', 'Add a new notification')}>
          {t('add_notification_button', 'Add Notification')}
        </Button>
      </header>
      <section className="ses-notifications-list" aria-label={t('aria.notifications_list', 'List of notifications')}>
        {notifications.length === 0 && !isLoading && (
          <p>{t('no_notifications', 'You have no new notifications.')}</p>
        )}
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              layout // Animate layout changes
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="notification-item-wrapper" // For layout animation
            >
              <Toast 
                type={notification.type} 
                message={notification.message} 
                onClose={() => removeNotification(notification.id)} // Add close handler
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </section>
    </div>
  );
};

export default NotificationsContent;
