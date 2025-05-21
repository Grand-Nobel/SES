import React from 'react';
// Adjusted paths based on tsconfig.json where @/ is src/
// and relative to src/app/dashboard/
import Topbar from '../../../packages/ui/src/Topbar/Topbar';
import Sidebar from '../../../packages/ui/src/Sidebar/Sidebar';
import ErrorBoundary from '../../components/ErrorBoundary'; // Path from src/app/dashboard to src/components
import './layout.css'; // Styles specific to this dashboard layout

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => (
  <ErrorBoundary>
    <div className="dashboard-layout">
      {/* Skip link for accessibility, targetting the main content area */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Topbar />
      <Sidebar />
      {/* Ensure main content has an ID that matches the skip link's href */}
      <main id="main-content" role="main">
        {children}
      </main>
    </div>
  </ErrorBoundary>
);

export default DashboardLayout;
