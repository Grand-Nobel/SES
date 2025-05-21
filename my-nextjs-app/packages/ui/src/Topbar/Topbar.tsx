'use client';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import SyncStatus from '@/components/SyncStatus';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useUIStore } from '@/stores/uiStore'; // Import the UI store
import { HamburgerIcon } from '../HamburgerIcon/HamburgerIcon'; // Import HamburgerIcon
import './Topbar.module.css';

const Topbar: React.FC = () => {
  const { t } = useTranslation('topbar');
  const { user, setAuth } = useAuthStore();
  const { isMobileMenuOpen, toggleMobileMenu } = useUIStore(); // Use UI store

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAuth({ tenantId: e.target.value, user });
  };

  return (
    <div className="h-16 bg-surface shadow-md flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        {/* Hamburger Menu Button for mobile */}
        <button
          aria-label="Toggle navigation menu"
          className="lg:hidden p-2 text-onSurface" // Added text-onSurface for visibility
          onClick={toggleMobileMenu}
        >
          <HamburgerIcon open={isMobileMenuOpen} />
        </button>
        {/* Placeholder for logo or app title */}
        <span className="text-xl font-bold text-onSurface">SEED-OS</span>
        {/* Tenant Switcher Placeholder */}
        <select onChange={handleTenantChange} className="bg-surface text-onSurface rounded p-1">
          <option value="tenant1">Tenant 1</option>
          <option value="tenant2">Tenant 2</option>
        </select>
      </div>
      <div className="flex items-center space-x-4">
        <SyncStatus />
        <LocaleSwitcher />
        {/* User Info Placeholder */}
        <span className="text-onSurface/70">{user?.tenantName || 'User'}</span>
      </div>
    </div>
  );
};

export default Topbar;
