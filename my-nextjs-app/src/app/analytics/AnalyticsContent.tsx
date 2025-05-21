'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Table } from '../../../packages/ui/src/Table/Table'; // Adjusted path
import { supabase } from '../../lib/supabase'; // Adjusted path
import './analytics.module.css'; // Assuming this file will be created

interface Metric {
  id: string;
  metric: string;
  value: string;
  change: string;
}

interface AnalyticsPageClientProps {
  // initialMetrics could be passed from a parent Server Component
}

const AnalyticsContent: React.FC<AnalyticsPageClientProps> = () => {
  const { t } = useTranslation('analytics');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      setIsLoading(true);
      setError(null);
      const tenantId = 'default'; // This should ideally come from authStore or context
      try {
        const { data, error: dbError } = await supabase
          .from('tenant_metrics')
          .select('id, metric, value, change')
          .eq('tenant_id', tenantId);

        if (dbError) throw dbError;
        setMetrics(data || []);
      } catch (err) {
        console.error("Failed to fetch analytics metrics:", err);
        setError(err instanceof Error ? err.message : "Failed to load metrics");
        setMetrics([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchMetrics();

    const intervalId = setInterval(fetchMetrics, 60 * 1000); // Re-fetch every 60 seconds
    return () => clearInterval(intervalId);

  }, []);

  const columns = [
    { id: 'metric', header: t('metric', 'Metric'), accessor: (row: Metric) => row.metric },
    { id: 'value', header: t('value', 'Value'), accessor: (row: Metric) => row.value },
    { id: 'change', header: t('change', 'Change'), accessor: (row: Metric) => row.change },
  ];

  if (isLoading) {
    return <div data-testid="analytics-loading">Loading analytics data...</div>;
  }

  if (error) {
    return <div role="alert" data-testid="analytics-error">Error loading data: {error}</div>;
  }

  return (
    <div className="analytics-page" data-testid="analytics-page">
      <h1>{t('title', 'Analytics Dashboard')}</h1>
      {metrics.length > 0 ? (
        <Table
          columns={columns}
          data={metrics}
          keyExtractor={(row) => row.id}
        />
      ) : (
        <p>{t('no_data', 'No analytics data available at the moment.')}</p>
      )}
    </div>
  );
};

export default AnalyticsContent;
