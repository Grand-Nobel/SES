'use client';
import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import Chart to avoid SSR issues with chart libraries
const Chart = dynamic(() => import('react-chartjs-2').then((mod) => mod.Line), { ssr: false });

interface LineChartProps {
  data: { labels: string[]; datasets: { label: string; data: number[] }[] };
  'data-testid'?: string;
}

const LineChart: React.FC<LineChartProps> = ({ data, 'data-testid': dataTestId = 'line-chart' }) => {
  // The SEED document had a check for `typeof window === 'undefined'` and returned null.
  // This is handled by `ssr: false` in dynamic import, but we can keep a guard if needed.
  // For simplicity, assuming dynamic import handles SSR correctly.
  
  return (
    
      <Chart data={data} />
    
  );
};

export default LineChart;
