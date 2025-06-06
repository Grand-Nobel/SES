import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import I18nProvider from '../../components/I18nProvider'; // Import the new client provider
// Adjusted paths based on tsconfig.json where @/ is src/
import Topbar from '../../../packages/ui/src/Topbar/Topbar';
import Sidebar from '../../../packages/ui/src/Sidebar/Sidebar';
import { ErrorBoundary } from '../../components/ErrorBoundary'; // Assuming this will be created
import InstallPrompt from '../../../packages/ui/src/InstallPrompt/InstallPrompt'; // Assuming this will be created
// import '../globals.css'; // Assuming global styles are still needed, path might need adjustment if globals.css is not in src/app

// Props for the layout
interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

// It's good practice to define metadata generation as a separate function if complex
// export async function generateMetadata({ params: { locale } }: LocaleLayoutProps): Promise<Metadata> {
//   // Example metadata, adjust as needed
//   return {
//     title: 'My App Title', // Replace with dynamic title if needed
//     description: 'My App Description',
//   };
// }

export default async function LocaleLayout({ children, params: { locale } }: LocaleLayoutProps) {
  let messages;
  try {
    // Make sure the path to locales is correct relative to this file
    messages = (await import(`../../../locales/${locale}/common.json`)).default;
  } catch (error) {
    console.error(`Failed to load locale messages for ${locale}:`, error);
    notFound(); // Triggers 404 if locale messages are missing
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <I18nProvider> {/* Use the new client provider */}
        <ErrorBoundary> {/* Wrap content in ErrorBoundary */}
          <div className="app-layout"> {/* Basic layout structure class */}
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <Topbar />
            <Sidebar />
            <Suspense fallback={<div data-testid="layout-suspense-fallback">Loading page content...</div>}>
              <main id="main-content" role="main"> {/* Added role="main" for accessibility */}
                {children}
              </main>
            </Suspense>
            <InstallPrompt />
          </div>
        </ErrorBoundary>
      </I18nProvider> {/* Close the new client provider */}
    </NextIntlClientProvider>
  );
}
