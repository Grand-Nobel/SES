'use client';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation'; // Added usePathname
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import './LocaleSwitcher.module.css';

const LocaleSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation('topbar'); // Assuming 'topbar' namespace for translations
  const { tenantId } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname

  const handleChange = async (newLocale: string) => {
    try {
      await i18n.changeLanguage(newLocale);
      // Construct the new path with the locale prefix
      // This assumes a basic internationalized routing setup where locales are path prefixes
      // e.g., /en/dashboard, /es/dashboard
      // More complex logic might be needed depending on the exact routing setup
      const currentPathSegments = pathname.split('/');
      if (currentPathSegments.length > 1 && /^[a-z]{2}(-[A-Z]{2})?$/.test(currentPathSegments[1])) {
        // If current path already has a locale prefix, replace it
        currentPathSegments[1] = newLocale;
      } else {
        // Otherwise, insert the new locale prefix
        currentPathSegments.splice(1, 0, newLocale);
      }
      const newPath = currentPathSegments.join('/');
      router.replace(newPath);

      const maskedEvent = await PrivacyLogger().log('locale_changed', { tenantId, locale: newLocale });
      await supabase.from('system_metrics').insert({
        tenant_id: tenantId,
        metric: 'locale_changed',
        value: maskedEvent,
      });
    } catch (error) {
      console.error('Locale change failed', error);
    }
  };

  return (
    
      English
      Arabic
      Spanish
    
  );
};

export default LocaleSwitcher;
