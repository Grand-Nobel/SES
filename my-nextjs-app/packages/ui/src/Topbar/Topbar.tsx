// components/Topbar/Topbar.tsx
'use client';

import React, { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore'; // Assuming @/ resolves to my-nextjs-app/src
import { useSession, signOut } from 'next-auth/react';
import SyncStatus from '@/components/SyncStatus'; // Assuming @/ resolves to my-nextjs-app/src
import { LocaleSwitcher } from '@/components/LocaleSwitcher'; // Assuming @/ resolves to my-nextjs-app/src
import { useUIStore } from '@/stores/uiStore'; // Assuming @/ resolves to my-nextjs-app/src
import { HamburgerIcon } from '../HamburgerIcon/HamburgerIcon'; // Relative path within packages/ui
import { Sun, Moon, User, LogOut, Settings, LifeBuoy } from 'lucide-react'; // Added more icons
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion'; // Added AnimatePresence

interface UserMenuItem {
  label: string;
  onClick?: () => void;
  href?: string;
  icon: React.ElementType;
}

interface TopbarProps {
  className?: string;
}

const Topbar: React.FC<TopbarProps> = ({ className }) => {
  const { t } = useTranslation('topbar');
  const { user: authStoreUser, setAuth } = useAuthStore(); // Renamed to avoid conflict with session.user
  const { data: session } = useSession();
  const { isMobileMenuOpen, toggleMobileMenu } = useUIStore();
  const { theme, setTheme } = useTheme();
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);

  const handleTenantChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    // Ensure authStoreUser is not null before accessing its properties
    if (authStoreUser) {
      setAuth({ tenantId: e.target.value, user: authStoreUser });
    } else if (session?.user) {
      // Fallback or initial set if authStoreUser is not yet populated
      const storeUserFromSession = {
        id: session.user.id ?? undefined,
        tenantName: session.user.name || `Tenant ${session.user.tenantId || 'Unknown'}`, // Construct tenantName
        // role: session.user.role // if role were on session.user
      };
      setAuth({ tenantId: e.target.value, user: storeUserFromSession });
    }
  }, [setAuth, authStoreUser, session]);

  const handleSignOut = useCallback(async () => {
    await signOut({ callbackUrl: '/' });
  }, []);

  const handleThemeToggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const handleToggleMobileMenu = useCallback(() => {
    toggleMobileMenu();
  }, [toggleMobileMenu]);

  const userMenuItems = useMemo(
    (): UserMenuItem[] => [
      // { label: t('profile', 'Profile'), href: '/profile', icon: User },
      // { label: t('accountSettings', 'Account Settings'), href: '/settings/account', icon: Settings },
      // { label: t('help', 'Help Center'), href: '/help', icon: LifeBuoy },
      {
        label: t('signOut', 'Sign Out'),
        onClick: handleSignOut,
        icon: LogOut,
      },
    ],
    [t, handleSignOut]
  );

  const currentUser = session?.user;

  return (
    <header className={`bg-surface text-onSurface p-4 shadow-md flex items-center justify-between sticky top-0 z-30 ${className || ''}`} aria-label={t('topbarNavigation', 'Topbar Navigation')}>
      <div className="flex items-center">
        <button
          onClick={handleToggleMobileMenu}
          className="md:hidden mr-3 p-2 rounded-md hover:bg-surface/50 focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t('toggleMobileMenu', 'Toggle mobile menu')}
          aria-expanded={isMobileMenuOpen}
        >
          <HamburgerIcon open={isMobileMenuOpen} />
        </button>
        <Link href="/" className="text-xl font-bold text-primary hover:opacity-80 transition-opacity">
          SEED-OS
        </Link>
        {(currentUser as any)?.tenantId && (
          <select 
            onChange={handleTenantChange} 
            value={authStoreUser?.tenantId || (currentUser as any)?.tenantId || ''}
            className="ml-4 p-2 bg-surface border border-surface/20 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={t('selectTenant', 'Select Tenant')}
          >
            <option value="tenant1">{t('tenant1', 'Tenant 1')}</option>
            <option value="tenant2">{t('tenant2', 'Tenant 2')}</option>
          </select>
        )}
      </div>
      
      <div className="flex items-center space-x-3">
        <SyncStatus />
        <LocaleSwitcher />
        <button
          onClick={handleThemeToggle}
          className="p-2 rounded-md hover:bg-surface/50 focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t('toggleTheme', 'Toggle light/dark mode')}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        {!currentUser && (
          <Link href="/auth/signin" className="p-2 rounded-md hover:bg-surface/50 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium">
            {t('signIn', 'Sign In')}
          </Link>
        )}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center p-1 rounded-full hover:bg-surface/50 focus:outline-none focus:ring-2 focus:ring-primary"
              aria-expanded={isUserMenuOpen}
              aria-controls="user-menu"
              aria-label={t('userMenu', 'User menu')}
            >
              <img 
                src={currentUser.image || `https://avatar.vercel.sh/${currentUser.email || currentUser.name || 'user'}.png?size=32`} 
                alt={t('userAvatar', 'User avatar') || 'User avatar'} 
                className="h-8 w-8 rounded-full" 
              />
            </button>
            <AnimatePresence>
              {isUserMenuOpen && (
                <motion.ul
                  id="user-menu"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-surface border border-surface/20 rounded-lg shadow-lg z-20 py-1"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="user-menu-button" // Assuming the button above has id="user-menu-button"
                >
                  {userMenuItems.map(item => (
                    <li key={item.label} role="none">
                      {item.href ? (
                        <Link 
                          href={item.href}
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center px-4 py-2 text-sm text-onSurface hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
                          role="menuitem"
                        >
                          <item.icon className="w-4 h-4 mr-2" aria-hidden="true" />
                          {item.label}
                        </Link>
                      ) : (
                        <button
                          onClick={() => {
                            item.onClick?.();
                            setIsUserMenuOpen(false);
                          }}
                          className="flex items-center w-full text-left px-4 py-2 text-sm text-onSurface hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
                          role="menuitem"
                        >
                          <item.icon className="w-4 h-4 mr-2" aria-hidden="true" />
                          {item.label}
                        </button>
                      )}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
