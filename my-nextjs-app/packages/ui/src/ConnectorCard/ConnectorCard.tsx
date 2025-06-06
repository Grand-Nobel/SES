'use client';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/packages/ui/src/Button';
import { useAuthStore } from '@/stores/authStore';
import { PrivacyLogger } from '@/lib/logging';
import { supabase } from '@/lib/supabase';
import { captureMessage } from '@sentry/nextjs';
import './ConnectorCard.module.css';

interface ConnectorCardProps {
  service: string;
  'data-testid'?: string;
}

const ConnectorCard: React.FC<ConnectorCardProps> = ({ service, 'data-testid': dataTestId = 'connector-card' }) => {
  const { t } = useTranslation('connectors');
  const { tenantId } = useAuthStore();
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkConnection() {
      try {
        const { data, error } = await supabase
          .from('integrations')
          .select('status')
          .eq('tenant_id', tenantId)
          .eq('service', service)
          .single();
        if (error) throw error;
        setStatus(data?.status || 'disconnected');
      } catch (error) {
        setStatus('error');
        setError(t('error.connection_failed'));
        captureMessage('Integration check failed', { extra: { error, tenantId, service } });
      }
    }
    if (tenantId) {
      checkConnection();
    }
  }, [tenantId, service, t]);

  const handleConnect = async () => {
    if (!tenantId) {
      setError(t('error.missing_tenant_id')); // Assuming a translation key for this error
      return;
    }
    try {
      const response = await fetch(`/api/integrations/${service}/connect`, {
        method: 'POST',
        headers: { 'x-tenant-id': tenantId as string }, // Cast to string after null check
      });
      if (!response.ok) throw new Error('Connection failed');
      setStatus('connected');
      const maskedEvent = await PrivacyLogger().log('integration_connected', { tenantId, service });
      await supabase.from('system_metrics').insert({
        tenant_id: tenantId,
        metric: 'integration_connected',
        value: maskedEvent,
      });
    } catch (error) {
      setStatus('error');
      setError(t('error.connection_failed'));
      captureMessage('Integration connection failed', { extra: { error, tenantId, service } });
    }
  };

  return (
    <div className="connector-card" data-testid={dataTestId}>
      <h3>{service}</h3>
      <p>{t('status')}: {status}</p>
      {status === 'error' && (
        <div className="error" data-testid={`${dataTestId}-error`}>
          {error}
          <Button onClick={handleConnect} data-testid={`${dataTestId}-retry`}>
            {t('retry')}
          </Button>
        </div>
      )}
      {status === 'disconnected' && (
        <Button onClick={handleConnect} data-testid={`${dataTestId}-connect`}>
          {t('connect')}
        </Button>
      )}
      {status === 'connected' && (
        <iframe
          src={`https://integrations.ses.com/${service}/dashboard`}
          title={`${service} Dashboard`}
          data-testid={`${dataTestId}-iframe`}
        />
      )}
    </div>
  );
};

export default ConnectorCard;
