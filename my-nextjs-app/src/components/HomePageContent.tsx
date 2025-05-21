import React from 'react';

import DashboardBuilder from "../../packages/ui/src/DashboardBuilder/DashboardBuilder";
// Import other components as needed
// import SankeyDiagram from "../../packages/ui/src/SankeyDiagram/SankeyDiagram";
import { Widget } from "../../packages/ui/src/DashboardBuilder/DashboardBuilder"; // Import Widget type
import ClientHomePageContent from './ClientHomePageContent';

const HomePageContent: React.FC = () => {
  const initialDashboardLayout: Widget[] = [
    { id: 'a', type: 'kpi', x: 0, y: 0, w: 2, h: 2, config: { title: 'Sample KPI 1', value: 123, trend: 'up' } },
    { id: 'b', type: 'kpi', x: 2, y: 0, w: 2, h: 2, config: { title: 'Sample KPI 2', value: 456, trend: 'down' } },
  ];

  // const sankeyNodes = [ { name: 'Lead A' }, { name: 'Lead B' }, { name: 'Sale' }];
  // const sankeyLinks = [ { source: 'Lead A', target: 'Sale', value: 5 }, { source: 'Lead B', target: 'Sale', value: 3 }];

  return (
    <main className="flex min-h-screen flex-col items-center container">
      <h1 className="text-3xl font-bold mb-8">SEED-OS Components Showcase</h1>

      {/*
      <section className="w-full max-w-6xl mb-12">
        <h2 className="text-2xl font-semibold mb-4">Dashboard Builder</h2>
        <div style={{ border: '1px solid #eee', padding: '1rem', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
          <DashboardBuilder initialLayout={initialDashboardLayout} data-testid="main-dashboard" />
        </div>
      </section>
      */}

      {/*
      <section className="w-full max-w-4xl mb-12">
        <h2 className="text-2xl font-semibold mb-4">Sankey Diagram</h2>
        <div style={{ border: '1px solid #eee', padding: '1rem', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
          <SankeyDiagram
            nodes={sankeyNodes}
            links={sankeyLinks}
            tenantId="showcase-tenant"
            chartId="showcase-sankey"
          />
        </div>
      </section>
      */}
      {/* <ClientHomePageContent /> */}
    </main>
  );
};

export default HomePageContent;
