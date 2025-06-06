'use client';
import React from 'react';
import { PrivacyLogger } from '@/lib/logging';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import Button from '../Button/Button'; // Corrected import path for Button
import styles from './KpiCard.module.css';
import { SkeletonLoader } from '../SkeletonLoader/SkeletonLoader'; // Import SkeletonLoader

interface KpiCardProps {
  title: string;
  value?: number; // Made value optional for loading state
  trend?: 'up' | 'down'; // Made trend optional for loading state
  isLoading?: boolean; // Added isLoading prop
  'data-testid'?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, trend, isLoading, 'data-testid': dataTestId = 'kpi-card' }) => {
  const { tenantId } = useAuthStore();

  const handleDownload = async () => {
    try {
      const csv = `title,value,trend\\n${title},${value},${trend}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      const maskedEvent = await PrivacyLogger().log('kpi_download', { tenantId, metric: title });
      await supabase.from('system_metrics').insert({
        tenant_id: tenantId,
        metric: 'kpi_download',
        value: maskedEvent,
      });
    } catch (error) {
      console.error('KPI download failed', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col" data-testid={dataTestId}>
        <SkeletonLoader height="1.25rem" width="70%" className="mb-1" borderRadius="var(--radius-2)" />
        <SkeletonLoader height="2rem" width="40%" className="mb-1" borderRadius="var(--radius-2)" />
        <SkeletonLoader height="1rem" width="30%" className="mb-3" borderRadius="var(--radius-2)" />
        <SkeletonLoader height="1.25rem" width="50%" borderRadius="var(--radius-2)" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" data-testid={dataTestId}>
      <span className="text-body text-onBackground/70">{title}</span>
      <span className="text-h2 font-bold">{value}</span>
      {trend && (
        <span className={`inline-flex items-center text-sm ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
          {trend === 'up' ? '▲' : '▼'} {trend}
        </span>
      )}
      <button className="mt-4 text-sm font-medium underline text-primary" onClick={handleDownload} data-testid={`${dataTestId}-download-button`}>
        Download CSV
      </button>
    </div>
  );
};

export default KpiCard;
