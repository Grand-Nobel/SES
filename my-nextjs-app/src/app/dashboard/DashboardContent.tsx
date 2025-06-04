'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Image from 'next/image';

import KpiCard from '../../../packages/ui/src/KpiCard/KpiCard';
import { Modal } from '../../../packages/ui/src/Modal/Modal';
import Button from '../../../packages/ui/src/Button/Button';
import { ScreenReaderAnnouncer } from '../../../packages/ui/src/ScreenReaderAnnouncer/ScreenReaderAnnouncer';
import { useTextZoomStore } from '../../stores/textZoomStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { PrivacyLogger } from '../../lib/logging';
import { supabase } from '../../lib/supabase';
import { agentRunner } from '../../lib/agents';
import { captureMessage } from '@sentry/nextjs';
import * as annyang from 'annyang';
import { encryptTokens } from '../../utils/encrypt';
import './page.scss';
import { LoadingState } from '../../../packages/ui/src/LoadingState/LoadingState';

const ShortcutRecommender = dynamic(() => import('../../components/ShortcutRecommender'), {
  ssr: false,
  loading: () => <LoadingState message="Loading recommendations..." />
});

const SyncStatus = dynamic(() => import('../../components/SyncStatus'), {
  ssr: false,
  loading: () => null, // Or a loading state for the sync status
});

const AiChatPrototype = dynamic(() => import('../../prototypes/AiChatPrototype'), {
  ssr: false,
  loading: () => <LoadingState message="Loading AI Chat..." />
});

interface Kpi {
  title: string;
  value: number; // Change to number
  trend?: 'up' | 'down'; // Change to optional 'up' or 'down'
}
interface TenantTheme {
  colors: { primary: string };
  typography: { primary: string };
}

const AUTH_TIMEOUT = 10000; // 10 seconds

const DashboardContent: React.FC = () => {
  console.log('Rendering DashboardContent');
  const { t, i18n } = useTranslation('dashboard');
  const logger = PrivacyLogger();
  const announcer = ScreenReaderAnnouncer.getInstance();
  
  const [initialKpis, setInitialKpis] = useState<Kpi[]>([]);
  const [initialSuggestions, setInitialSuggestions] = useState<string[]>([]);
  const [tenantLogo, setTenantLogo] = useState('/logo.png'); 
  const [tenantTheme, setTenantTheme] = useState<TenantTheme>({ colors: { primary: '#0057FF' }, typography: { primary: 'Roboto' }});

  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regionConfig, setRegionConfig] = useState<{ primaryColor?: string; currencyFormat?: string; direction?: 'ltr' | 'rtl', language?: string }>({});
  const [layoutPriority, setLayoutPriority] = useState<'chat' | 'kpis'>('chat');
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [customColor, setCustomColor] = useState(tenantTheme.colors.primary);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);

  // Unconditional hook calls
  const { tenantId: currentAuthTenantId, user: currentAuthUser, initialize: initializeAuth, isLoading: currentAuthIsLoading } = useAuthStore();
  const { initialize: initializeThemeAction, error: themeErrorState } = useThemeStore();
  const { isHighZoom: isHighZoomState, initialize: initializeZoomAction } = useTextZoomStore();

  useEffect(() => {
    setCustomColor(tenantTheme.colors.primary);
  }, [tenantTheme.colors.primary]);

  useEffect(() => {
    let cleanupZoom: (() => void) | undefined;

    async function fetchInitialData(currentTenantId: string, currentUserId?: string) {
      try {
        const { data: tenantData } = await supabase
          .from('tenant_themes')
          .select('logo, colors, typography')
          .eq('tenant_id', currentTenantId)
          .single();
        if (tenantData) {
          setTenantLogo(tenantData.logo || '/logo.png');
          setTenantTheme({
            colors: tenantData.colors || { primary: '#0057FF' },
            typography: tenantData.typography || { primary: 'Roboto' },
          });
        }

        const suggestionsResponse = await fetch('https://personalization.ses.com/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: currentTenantId, field: 'input' }),
        });
        if(suggestionsResponse.ok) {
          const suggestionsData = await suggestionsResponse.json();
          setInitialSuggestions(suggestionsData.suggestions || []);
        } else {
          console.warn("Failed to fetch suggestions");
          setInitialSuggestions([]);
        }
        
        const kpiResponse = await agentRunner.run({
          agentName: 'KpiGenerator',
          action: 'generateKpis',
          payload: { tenantId: currentTenantId, userId: currentUserId || 'client-user', currencyFormat: 'USD' },
          cache: { key: `kpis:${currentTenantId}`, ttl: 3600 },
        });
        const fetchedKpis = ((kpiResponse as any).kpis || []).map((kpi: any) => ({
          title: kpi.title,
          value: parseFloat(kpi.value), // Convert value to number
          trend: kpi.trend === 'neutral' ? undefined : kpi.trend, // Handle 'neutral' trend
        }));
        setInitialKpis(fetchedKpis);
        setKpis(fetchedKpis);
        setIsDataLoaded(true);
      } catch (err) {
        console.error("Failed to fetch initial dashboard data:", err);
        setError(t('error.page_load', { message: err instanceof Error ? err.message : 'Failed to load initial data' }));
        setIsDataLoaded(true);
      }
    }

    async function initializePage() {
      const startTime = Date.now();
      try {
        await Promise.race([
          initializeAuth(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Authentication timed out')), AUTH_TIMEOUT)),
        ]);
        
        if (!currentAuthTenantId) {
          throw new Error('Failed to initialize tenant ID');
        }
        setIsAuthLoaded(true);
        const currentTenantId = currentAuthTenantId;
        const currentUserId = currentAuthUser?.id;

        // All subsequent calls requiring tenantId are now safe
        await fetchInitialData(currentTenantId, currentUserId);
        await initializeThemeAction(currentTenantId);
        if (themeErrorState) { 
          console.error("Theme store initialization error:", themeErrorState);
        }
        cleanupZoom = initializeZoomAction(currentTenantId);
            
        const regionResponse = await fetch(`https://cdn.ses.com/config/tenant_regions/${currentTenantId}.json`);
        if(regionResponse.ok) {
          const regionData = await regionResponse.json();
          if (regionData) {
            const newRegionConfig = {
              primaryColor: regionData.theme?.primaryColor || tenantTheme.colors.primary,
              currencyFormat: regionData.currency_format || 'USD',
              direction: regionData.direction || 'ltr',
              language: regionData.language || 'en',
            };
            setRegionConfig(newRegionConfig);
            document.documentElement.style.setProperty('--color-synthesis-blue', newRegionConfig.primaryColor);
            document.documentElement.setAttribute('dir', newRegionConfig.direction);
            if (i18n.language !== newRegionConfig.language) i18n.changeLanguage(newRegionConfig.language);
          }
        } else {
            const { data: supabaseData, error: regionError } = await supabase
            .from('tenant_regions')
            .select('theme, currency_format, direction, language')
            .eq('tenant_id', currentTenantId)
            .single();
          if (regionError && regionError.code !== 'PGRST116') throw regionError;
          if (supabaseData) {
            const newRegionConfig = {
                primaryColor: supabaseData.theme?.primaryColor || tenantTheme.colors.primary,
                currencyFormat: supabaseData.currency_format || 'USD',
                direction: supabaseData.direction || 'ltr',
                language: supabaseData.language || 'en',
            };
            setRegionConfig(newRegionConfig);
            document.documentElement.style.setProperty('--color-synthesis-blue', newRegionConfig.primaryColor);
            document.documentElement.setAttribute('dir', newRegionConfig.direction);
            if (i18n.language !== newRegionConfig.language) i18n.changeLanguage(newRegionConfig.language);
          }
        }
            
        const optimizationResponse = await agentRunner.run({
          agentName: 'LayoutOptimizer',
          action: 'optimizeLayoutAndStyles',
          payload: { tenantId: currentTenantId, userId: currentUserId },
          cache: { key: `optimization:${currentTenantId}`, ttl: 3600 },
        });
        setLayoutPriority((optimizationResponse as any).priority || 'chat');
        if ((optimizationResponse as any).styles?.kpiCardColor) {
          document.documentElement.style.setProperty('--kpi-card-color', (optimizationResponse as any).styles.kpiCardColor);
        }
        const hiddenSections = (optimizationResponse as any).hiddenSections || [];
        setKpis(currentKpisList => hiddenSections.includes('kpis') ? [] : currentKpisList.length > 0 ? currentKpisList : initialKpis);

        const pageRenderPayload = { tenantId: currentTenantId, userId: currentUserId, kpiCount: kpis.length, layoutPriority, region: regionConfig.currencyFormat };
        const maskedEvent = await logger.maskPersonalData(pageRenderPayload);
        await supabase.from('system_metrics').insert({
          tenant_id: currentTenantId,
          metric: 'page_render',
          value: { duration: Date.now() - startTime, ...maskedEvent } as any,
        });
        announcer.announce(t('aria.page_loaded'), currentTenantId, false);
        
        // @ts-ignore annyang might have type issues
        if (annyang && (annyang as any).addCommands) {
          const commands = {
            'open settings': () => { setIsSettingsOpen(true); announcer.announce(t('aria.settings_opened'), currentTenantId, false); },
            'close settings': () => { setIsSettingsOpen(false); announcer.announce(t('aria.settings_closed'), currentTenantId, false); },
            'toggle contrast': () => {
              setIsHighContrast((prev) => {
                const newValue = !prev;
                document.documentElement.style.setProperty('--background-color', newValue ? '#000000' : '#ffffff');
                document.documentElement.style.setProperty('--text-color', newValue ? '#ffffff' : '#000000');
                announcer.announce(newValue ? t('aria.high_contrast_enabled') : t('aria.high_contrast_disabled'), currentTenantId, false);
                return newValue;
              });
            },
          };
          // @ts-ignore
          (annyang as any).addCommands(commands);
          // @ts-ignore
          (annyang as any).start({ autoRestart: true, continuous: false });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during initialization';
        setError(t('error.page_load', { message: errorMessage }));
        const finalTenantId = currentAuthTenantId; // Use the hook value
        captureMessage('Page initialization failed', { extra: { error: errorMessage, tenantId: finalTenantId } });
        announcer.announce(t('error.page_load_aria', {message: "Page failed to load"}), finalTenantId, true);
      }
    }
    initializePage();
    return () => {
      if (cleanupZoom) cleanupZoom();
      // @ts-ignore
      if (annyang && (annyang as any).abort) (annyang as any).abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleSaveCustomColor = async () => {
    // Use the hook value directly
    if (!currentAuthTenantId) { 
        setError("Tenant ID not available for saving theme.");
        return;
    }
    try {
      const encryptedTokens = await encryptTokens({ primaryColor: customColor });
      const { error: upsertError } = await supabase
        .from('tenant_themes')
        .upsert({ tenant_id: currentAuthTenantId, tokensEncrypted: encryptedTokens, version: '1.0.0' });
      if (upsertError) throw upsertError;
      document.documentElement.style.setProperty('--color-synthesis-blue', customColor);
      setRegionConfig({ ...regionConfig, primaryColor: customColor });
      setShowConsentModal(false);
      // Use the hook value directly
      const maskedEvent = await logger.maskPersonalData({ tenantId: currentAuthTenantId, userId: currentAuthUser?.id, primaryColor: customColor });
      await supabase.from('system_metrics').insert({
        tenant_id: currentAuthTenantId,
        metric: 'theme_customized',
        value: maskedEvent as any,
      });
      announcer.announce(t('aria.theme_saved'), currentAuthTenantId, false);
    } catch (err) {
      setError(t('error.theme_save_failed'));
      captureMessage('Theme save failed', { extra: { error: err, tenantId: currentAuthTenantId } });
    }
  };

  if (currentAuthIsLoading || !isDataLoaded) {
    return <LoadingState data-testid="dashboard-page-loading" message={t('loading', 'Loading Dashboard...')} />;
  }
  
  if (!currentAuthTenantId) {
    return <div role="alert">{t('error.auth_failed', 'Authentication failed. Tenant ID is missing.')}</div>;
  }
  
  return (
    <div 
      className={isHighZoomState ? 'ses-dashboard zoomed' : 'ses-dashboard'}
      aria-label={t('aria.dashboard')}
      tabIndex={-1}
    >
      <header className="ses-header">
        <Image src={tenantLogo} alt={`${currentAuthUser?.tenantName || 'SES'} Logo`} width={100} height={40} priority data-testid="logo" />
        <h1>{t('title', { tenant: currentAuthUser?.tenantName || 'SES' })}</h1>
        <Button
          onClick={async () => {
            setIsSettingsOpen(true);
            const maskedEvent = await logger.maskPersonalData({ tenantId: currentAuthTenantId, userId: currentAuthUser?.id });
            await supabase.from('system_metrics').insert({
              tenant_id: currentAuthTenantId,
              metric: 'settings_interaction',
              value: maskedEvent as any,
            });
          }}
          aria-label={t('aria.settings_button')}
        >
          {t('settings_button', 'Settings')}
        </Button>
        <Button
          onClick={() => {
            setIsHighContrast((prev) => {
              const newValue = !prev;
              document.documentElement.style.setProperty('--background-color', newValue ? '#000000' : '#ffffff');
              document.documentElement.style.setProperty('--text-color', newValue ? '#ffffff' : '#000000');
              announcer.announce(newValue ? t('aria.high_contrast_enabled') : t('aria.high_contrast_disabled'), currentAuthTenantId, false);
              return newValue;
            });
          }}
          aria-label={t('aria.toggle_contrast')}
        >
          {t('toggle_contrast', 'Toggle Contrast')}
        </Button>
      </header>
      
      <AnimatePresence mode="wait">
        {layoutPriority === 'kpis' ? (
          <motion.div key="kpis-first" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <section className="ses-kpis" aria-label={t('aria.kpis')}>
              <div className="ses-grid">
                {kpis.length > 0 ? (
                  kpis.map((kpi, index) => (
                    <KpiCard
                      key={index}
                      title={kpi.title}
                      value={kpi.value}
                      trend={kpi.trend}
                    />
                  ))
                ) : (
                  <p>{t('no_kpis', 'No KPIs available at the moment.')}</p>
                )}
              </div>
            </section>
            <section className="ses-chat" aria-label={t('aria.chat')}>
              <Suspense fallback={<LoadingState message="Loading AI Chat..." />}>
                <AiChatPrototype initialSuggestions={initialSuggestions} />
              </Suspense>
            </section>
          </motion.div>
        ) : (
          <motion.div key="chat-first" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <section className="ses-chat" aria-label={t('aria.chat')}>
              <Suspense fallback={<LoadingState message="Loading AI Chat..." />}>
                <AiChatPrototype initialSuggestions={initialSuggestions} />
              </Suspense>
            </section>
            <section className="ses-kpis" aria-label={t('aria.kpis')}>
              <Suspense fallback={<LoadingState message="Loading KPIs..." />}>
                <div className="ses-grid">
                  {kpis.length > 0 ? (
                    kpis.map((kpi, index) => (
                      <KpiCard
                        key={index}
                        title={kpi.title}
                        value={kpi.value}
                        trend={kpi.trend}
                      />
                    ))
                  ) : (
                    <p>{t('no_kpis', 'No KPIs available at the moment.')}</p>
                  )}
                </div>
              </Suspense>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      <Suspense fallback={<LoadingState message="Loading recommendations..."/>}>
        <ShortcutRecommender position="sidebar" />
      </Suspense>
      
      <SyncStatus /> {/* Add SyncStatus component */}

      {error && (
        <div className="ses-error" role="alert">
          {error}
        </div>
      )}
      
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title={t('settings_title', 'Application Settings')}
      >
        <p>{t('settings_content', 'Customize your application experience.')}</p>
        <div className="theme-customizer">
          <h2>{t('customize_colors', 'Customize Theme Colors')}</h2>
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            aria-label={t('aria.select_color', 'Select primary color')}
          />
          <Button onClick={() => setShowConsentModal(true)}>{t('apply_color', 'Apply Color')}</Button>
        </div>
        <Button onClick={() => setIsSettingsOpen(false)} style={{ marginLeft: '10px' }}>{t('close_button', 'Close')}</Button>
      </Modal>
      
      <Modal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        title={t('consent_title', 'Confirm Color Change')}
      >
        <p>{t('consent_message', 'Are you sure you want to apply this color? This will be saved as your preference.')}</p>
        <label style={{ display: 'block', margin: '10px 0' }}>
          <input
            type="checkbox"
            checked={hasConsented}
            onChange={(e) => setHasConsented(e.target.checked)}
            aria-label={t('aria.consent_checkbox', 'I understand and wish to proceed')}
          />
          {' '}{t('consent_label', 'I understand and wish to proceed.')}
        </label>
        <Button onClick={handleSaveCustomColor} disabled={!hasConsented}>
          {t('save_button', 'Save and Apply')}
        </Button>
        <Button onClick={() => setShowConsentModal(false)} style={{ marginLeft: '10px' }}>{t('cancel_button', 'Cancel')}</Button>
      </Modal>
    </div>
  );
};

// Helper function placeholder for decryptTokens if not already available
async function decryptTokens(encryptedData: string): Promise<Record<string, any> | null> {
    if (encryptedData.startsWith('mock-encrypted:')) {
        const base64Part = encryptedData.replace('mock-encrypted:', '');
        const reversed = typeof window !== 'undefined' ? atob(base64Part) : Buffer.from(base64Part, 'base64').toString('utf-8');
        const originalString = reversed.split('').reverse().join('');
        return JSON.parse(originalString);
    }
    return null;
}


export default DashboardContent;
