// my-nextjs-app/src/app/settings/layout.tsx
import React from 'react';
// Adjusted paths relative to src/app/settings/
import Topbar from '../../../packages/ui/src/Topbar/Topbar';
import Sidebar from '../../../packages/ui/src/Sidebar/Sidebar';
import ErrorBoundary from '../../components/ErrorBoundary'; 
// It's good practice to have a specific CSS for settings layout if needed, or use a general app layout style
// import './settings-layout.css'; 

interface SettingsLayoutProps {
  children: React.ReactNode;
}

const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => (
  <ErrorBoundary>
    {/* Assuming a similar overall structure to DashboardLayout */}
    <div className="settings-layout"> {/* Use a more specific class or reuse dashboard-layout if identical */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Topbar />
      <Sidebar />
      <main id="main-content" role="main">
        {children}
      </main>
    </div>
  </ErrorBoundary>
);

export default SettingsLayout;
