// components/Sidebar/Sidebar.tsx
'use client';

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { signOut, useSession } from 'next-auth/react';
import { useUIStore } from '@/stores/uiStore'; // Assuming @/ resolves to my-nextjs-app/src
import { FocusTrap } from '../Modal/FocusTrap'; // Relative path within packages/ui
import { motion, AnimatePresence } from 'framer-motion';
import { Home, BarChart, Bell, Puzzle, Settings, LogOut, Briefcase, Users, FileText } from 'lucide-react'; // Added more icons based on typical dashboard names

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  subItems?: NavSubItem[];
}

interface NavSubItem {
  href: string;
  label: string;
}

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const { t } = useTranslation('sidebar');
  const { isMobileMenuOpen, toggleMobileMenu } = useUIStore();
  const sidebarRef = useRef<HTMLElement>(null); // Correct ref type
  const { data: session, status } = useSession();

  const handleSignOut = useCallback(async () => {
    await signOut({ callbackUrl: '/' });
  }, []);

  const navItems = useMemo(
    (): NavItem[] => [ // Explicitly type the array
      { 
        href: '/dashboard', 
        label: t('dashboard', 'Dashboard'), 
        icon: Home, 
        subItems: [
          { href: '/dashboard/overview', label: t('overview', 'Overview') },
          { href: '/dashboard/reports', label: t('reports', 'Reports') },
        ]
      },
      { href: '/analytics', label: t('analytics', 'Analytics'), icon: BarChart },
      { href: '/notifications', label: t('notifications', 'Notifications'), icon: Bell },
      { href: '/marketplace', label: "Marketplace (Hardcoded)", icon: Puzzle }, // Hardcoded label for testing
      { href: '/settings', label: t('settings', 'Settings'), icon: Settings },
      // Example additional items based on common dashboard patterns
      // { href: '/projects', label: t('projects', 'Projects'), icon: Briefcase },
      // { href: '/team', label: t('team', 'Team'), icon: Users },
      // { href: '/documents', label: t('documents', 'Documents'), icon: FileText },
    ],
    [t]
  );

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
    <aside ref={sidebarRef} className={`bg-surface text-onSurface flex flex-col h-full shadow-lg ${className || ''}`} aria-label={t('sidebarNavigation', 'Sidebar Navigation')}>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <ul role="menu" aria-orientation="vertical" aria-labelledby="sidebar-menu-heading"> {/* Added role and aria attributes */}
          {navItems.map(item => (
            <li key={item.href} role="none"> {/* Added role="none" to li */}
              <Link 
                href={item.href}
                onClick={isMobileMenuOpen ? toggleMobileMenu : undefined}
                className="flex items-center p-2 rounded-lg hover:bg-primary/10 focus:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-150"
                role="menuitem" // Added role
              >
                <item.icon className="w-5 h-5 mr-3 flex-shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
              {item.subItems && (
                <ul className="pl-6 mt-1 space-y-1" role="group"> {/* Added role="group" */}
                  {item.subItems.map(subItem => (
                    <li key={subItem.href} role="none">
                      <Link 
                        href={subItem.href}
                        onClick={isMobileMenuOpen ? toggleMobileMenu : undefined}
                        className="flex items-center p-2 rounded-lg hover:bg-primary/10 focus:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary transition-colors duration-150 text-sm"
                        role="menuitem" // Added role
                      >
                        {subItem.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
      {status === 'authenticated' && (
        <div className="p-4 border-t border-surface/20">
          <button
            onClick={handleSignOut}
            className="flex items-center w-full p-2 rounded-lg hover:bg-error/10 text-error focus:bg-error/10 focus:outline-none focus:ring-2 focus:ring-error transition-colors duration-150"
            aria-label={t('signOutAriaLabel', 'Sign out of your account')}
          >
            <LogOut className="w-5 h-5 mr-3" aria-hidden="true" />
            <span>{t('signOut', 'Sign Out')}</span>
          </button>
        </div>
      )}
    </aside>
  );

  // Handle mobile menu with FocusTrap and AnimatePresence
  if (isMobileMenuOpen) {
    return (
      <FocusTrap>
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={toggleMobileMenu}
          aria-hidden="true"
        />
        <AnimatePresence>
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 w-64 md:hidden"
          >
            {SidebarContent}
          </motion.div>
        </AnimatePresence>
      </FocusTrap>
    );
  }

  // Desktop sidebar (always visible or controlled by other means if needed)
  return isMobileMenuOpen ? (
    <FocusTrap>
      <div
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={toggleMobileMenu}
        aria-hidden="true"
      />
      <AnimatePresence>
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed inset-y-0 left-0 z-50 w-64 md:hidden"
        >
          {SidebarContent}
        </motion.div>
      </AnimatePresence>
    </FocusTrap>
  ) : null; // Return null when the sidebar is closed
};

export default Sidebar;
