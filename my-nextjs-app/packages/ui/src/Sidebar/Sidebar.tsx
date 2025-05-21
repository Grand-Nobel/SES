'use client';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { signOut, useSession } from 'next-auth/react'; // Import signOut and useSession
// Using alias path for ShortcutRecommender
import ShortcutRecommender from '@/components/ShortcutRecommender'; 
import { useUIStore } from '@/stores/uiStore'; // Import the UI store
import { FocusTrap } from '../Modal/FocusTrap'; // Assuming FocusTrap is reusable
import './Sidebar.module.css';

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const { t } = useTranslation('sidebar');
  const { isMobileMenuOpen, toggleMobileMenu } = useUIStore();
  const sidebarRef = useRef<HTMLElement>(null);
  const { data: session, status } = useSession(); // Get session status

  const handleSignOut = async () => {
    // Optionally, specify a callbackUrl if you want to redirect after sign-out
    // By default, it might redirect to the home page or a page specified in NextAuth config
    await signOut({ callbackUrl: '/' });
  };

  // Close sidebar on escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileMenuOpen) {
        toggleMobileMenu();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen, toggleMobileMenu]);

  const SidebarContent = (
    <aside 
      ref={sidebarRef}
      className={`
        fixed inset-y-0 left-0 w-64 bg-surface z-40
        transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        transition-transform duration-200 ease-in-out
        lg:static lg:translate-x-0
        border-r border-[rgba(224,224,255,0.1)]
        ${className || ''}
      `} 
      aria-label={t('aria.navigation', 'Main navigation')}
      aria-hidden={!isMobileMenuOpen && true} // Hide from screen readers when closed on mobile
      tabIndex={-1} // Make it focusable for the FocusTrap
    >
      <nav className="sidebar__nav p-4"> {/* Added padding for content */}
        <ul>
          <li>
            <a href="/dashboard" className="text-onSurface hover:text-primary block py-2">{t('dashboard', 'Dashboard')}</a>
            <ul>
              <li><a href="/dashboard/overview" className="text-onSurface/70 hover:text-primary block py-1 pl-4">{t('overview', 'Overview')}</a></li>
              <li><a href="/dashboard/reports" className="text-onSurface/70 hover:text-primary block py-1 pl-4">{t('reports', 'Reports')}</a></li>
            </ul>
          </li>
          <li><a href="/analytics" className="text-onSurface hover:text-primary block py-2">{t('analytics', 'Analytics')}</a></li>
          <li><a href="/notifications" className="text-onSurface hover:text-primary block py-2">{t('notifications', 'Notifications')}</a></li>
          <li>
            <a href="/integrations" className="text-onSurface hover:text-primary block py-2">{t('integrations', 'Integrations')}</a>
            {/* Optional: Sub-links for integrations, e.g., direct to marketplace or specific integration types */}
            <ul>
              <li><a href="/marketplace" className="text-onSurface/70 hover:text-primary block py-1 pl-4">{t('marketplace', 'Marketplace')}</a></li>
              {/* Add other integration sub-links here if needed */}
            </ul>
          </li>
          <li><a href="/settings" className="text-onSurface hover:text-primary block py-2">{t('settings', 'Settings')}</a></li>
          {status === 'authenticated' && (
            <li>
              <button
                onClick={handleSignOut}
                className="text-onSurface hover:text-primary block py-2 w-full text-left"
              >
                {t('signOut', 'Sign Out')}
              </button>
            </li>
          )}
        </ul>
      </nav>
      <div className="p-4"> {/* Added padding for content */}
        <ShortcutRecommender position="sidebar" />
      </div>
    </aside>
  );

  // Conditionally wrap with FocusTrap only when the mobile menu is open
  // and it's a mobile view (where the sidebar is not static)
  // The lg:static class handles the desktop view, so FocusTrap is mainly for mobile.
  if (isMobileMenuOpen) {
    return <FocusTrap>{SidebarContent}</FocusTrap>;
  }

  return SidebarContent;
};

export default Sidebar;
