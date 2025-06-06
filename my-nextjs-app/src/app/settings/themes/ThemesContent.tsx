'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../../../packages/ui/src/Button/Button'; // Adjusted path
import { Modal } from '../../../../packages/ui/src/Modal/Modal';   // Adjusted path
import { useAuthStore } from '../../../stores/authStore';
import { useThemeStore } from '../../../stores/themeStore';
import { PrivacyLogger } from '../../../lib/logging';
import { supabase } from '../../../lib/supabase';
import { captureMessage } from '@sentry/nextjs';
import { ScreenReaderAnnouncer } from '../../../../packages/ui/src/ScreenReaderAnnouncer/ScreenReaderAnnouncer';
import { encryptTokens } from '../../../utils/encrypt';
import './themes.module.css'; // Assuming this file will be created

// Adapting to a Client Component structure
const ThemesContent: React.FC = () => {
  const { t } = useTranslation('settings'); // Namespace for translations
  const authTenantId = useAuthStore(state => state.tenantId);
  const authUser = useAuthStore(state => state.user);
  const { primaryColor: storePrimaryColor, initialize: initializeThemeStore, setTheme } = useThemeStore();
  const logger = PrivacyLogger();
  const announcer = ScreenReaderAnnouncer.getInstance();
  
  const [customColor, setCustomColor] = useState(storePrimaryColor || '#0057FF');
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize theme store and fetch initial color if tenantId is available
    async function loadInitialTheme() {
      if (authTenantId) {
        setIsLoading(true);
        await initializeThemeStore(authTenantId); // Initialize store, which might fetch data
        
        // Fetch initial primary color from DB, similar to outline's getServerSideProps
        try {
          const { data: tenantData, error: dbError } = await supabase
            .from('tenant_themes')
            .select('primary_color, tokensEncrypted') // Assuming primary_color might be stored unencrypted or tokensEncrypted holds it
            .eq('tenant_id', authTenantId)
            .single();

          if (dbError && dbError.code !== 'PGRST116') throw dbError; // PGRST116: 0 rows, not an error for this
          
          let colorToSet = '#0057FF'; // Default
          if (tenantData) {
            if (tenantData.primary_color) {
              colorToSet = tenantData.primary_color;
            } else if (tenantData.tokensEncrypted) {
              // If only encrypted tokens are stored, decrypt to get the color
              const decrypted = await decryptTokens(tenantData.tokensEncrypted);
              if (decrypted?.primaryColor && typeof decrypted.primaryColor === 'string') {
                colorToSet = decrypted.primaryColor;
              }
            }
          }
          setCustomColor(colorToSet);
          // Also update the store if it wasn't updated by initializeThemeStore
          // This depends on how initializeThemeStore is implemented.
          // For now, we directly set the customColor state.
          // If themeStore should reflect this DB value, call setTheme here.
          // setTheme({ primaryColor: colorToSet }); 
        } catch (err) {
          console.error("Failed to fetch initial theme color:", err);
          // Keep default color if fetch fails
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false); // No tenantId, nothing to load
      }
    }
    loadInitialTheme();
  }, [authTenantId, initializeThemeStore]);

  // Update customColor state if storePrimaryColor changes (e.g. by another component)
  useEffect(() => {
    if (storePrimaryColor) {
      setCustomColor(storePrimaryColor);
    }
  }, [storePrimaryColor]);


  const handleSaveCustomColor = async () => {
    if (!authTenantId) {
      setError(t('error.tenant_id_missing', "Tenant ID is missing. Cannot save theme."));
      return;
    }
    try {
      const encryptedTokens = await encryptTokens({ primaryColor: customColor });
      const { error: upsertError } = await supabase
        .from('tenant_themes')
        .upsert({ tenant_id: authTenantId, tokensEncrypted: encryptedTokens, primary_color: customColor, version: '1.0.0' }); // Save both for easier query
      
      if (upsertError) throw upsertError;
      
      document.documentElement.style.setProperty('--color-synthesis-blue', customColor); // Apply globally
      setTheme({ primaryColor: customColor }); // Update store
      setShowConsentModal(false);
      setHasConsented(false); // Reset consent

      const maskedEvent = await logger.maskPersonalData({ tenantId: authTenantId, userId: authUser?.id, primaryColor: customColor });
      await supabase.from('system_metrics').insert({
        tenant_id: authTenantId,
        metric: 'theme_customized',
        value: maskedEvent as unknown as Record<string, unknown>, // More specific than any
      });
      announcer.announce(t('aria.theme_saved', 'Theme saved successfully'), authTenantId, false);
    } catch (err) {
      console.error("Failed to save theme:", err);
      setError(t('error.theme_save_failed', 'Failed to save theme. Please try again.'));
      captureMessage('Theme save failed', { extra: { error: err, tenantId: authTenantId } });
    }
  };

  if (isLoading) {
    return <div data-testid="themes-loading">Loading theme settings...</div>;
  }

  if (!authTenantId) {
    return <div role="alert">{t('error.auth_required', 'Authentication required to manage themes.')}</div>;
  }

  return (
    <div className="themes-page" data-testid="themes-page">
      <h1>{t('themes_title', 'Customize Theme')}</h1>
      <div className="theme-customizer">
        <h2>{t('customize_colors', 'Primary Color')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            aria-label={t('aria.select_color', 'Select primary color')}
            data-testid="color-picker"
            style={{ width: '50px', height: '50px', border: 'none', padding: '0', borderRadius: '4px' }}
          />
          <input 
            type="text" 
            value={customColor} 
            onChange={(e) => setCustomColor(e.target.value)}
            aria-label={t('aria.color_hex_input', 'Primary color hex value')}
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <div style={{ width: '30px', height: '30px', backgroundColor: customColor, border: '1px solid #ccc', borderRadius: '4px' }}></div>
        </div>
        <Button onClick={() => setShowConsentModal(true)} data-testid="apply-color-button" style={{ marginTop: '10px' }}>
          {t('apply_color', 'Apply Color')}
        </Button>
      </div>
      {error && (
        <div className="error-message" role="alert" data-testid="themes-error" style={{ color: 'red', marginTop: '10px' }}>
          {error}
        </div>
      )}
      <Modal
        isOpen={showConsentModal}
        onClose={() => { setShowConsentModal(false); setHasConsented(false); }}
        title={t('consent_title', 'Confirm Theme Change')}
      >
        <p>{t('consent_message', 'Are you sure you want to apply this color? This will be saved as your preference for this tenant.')}</p>
        <label style={{ display: 'block', margin: '10px 0' }}>
          <input
            type="checkbox"
            checked={hasConsented}
            onChange={(e) => setHasConsented(e.target.checked)}
            aria-label={t('aria.consent_checkbox', 'I understand and wish to proceed')}
            data-testid="consent-checkbox"
          />
          {' '}{t('consent_label', 'I understand and wish to proceed.')}
        </label>
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button onClick={() => { setShowConsentModal(false); setHasConsented(false); }} data-testid="cancel-consent-button" variant="secondary">
            {t('cancel_button', 'Cancel')}
          </Button>
          <Button onClick={handleSaveCustomColor} disabled={!hasConsented} data-testid="save-theme-button">
            {t('save_button', 'Save and Apply')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

// Helper function placeholder for decryptTokens if not already available
async function decryptTokens(encryptedData: string): Promise<Record<string, unknown> | null> { // Changed any to unknown
    if (encryptedData.startsWith('mock-encrypted:')) {
        const base64Part = encryptedData.replace('mock-encrypted:', '');
        const reversed = typeof window !== 'undefined' ? atob(base64Part) : Buffer.from(base64Part, 'base64').toString('utf-8');
        const originalString = reversed.split('').reverse().join('');
        return JSON.parse(originalString);
    }
    return null;
}


export default ThemesContent;
