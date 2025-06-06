// src/app/layout.tsx
import { AppShell } from '../components/AppShell';
import ClientLayoutWrapper from '../components/ClientLayoutWrapper'; // Import the new wrapper
import NextAuthSessionProvider from '../components/NextAuthSessionProvider';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/route';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="en">
      <body>
        <NextAuthSessionProvider session={session}>
          <AppShell>
            <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
          </AppShell>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}
