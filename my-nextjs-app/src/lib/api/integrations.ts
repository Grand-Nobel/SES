// lib/api/integrations.ts
import { PrismaClient, Integration } from '@prisma/client'; // UserIntegration is unused, logger is unused

// Singleton PrismaClient
const prisma = (globalThis as any).prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
  (globalThis as any).prisma = prisma;
}

export async function fetchIntegrations(tenantId: string | undefined | null): Promise<(Integration & { isInstalled: boolean })[]> { // Added return type
  if (!tenantId) throw new Error('Tenant ID is required');
  const integrations = await prisma.integration.findMany();
  const userIntegrations = await prisma.userIntegration.findMany({
    where: { tenantId },
    select: { integrationId: true },
  });
  const installedIds = new Set(userIntegrations.map((ui: { integrationId: string }) => ui.integrationId));
  return integrations.map((integration: Integration) => ({
    ...integration,
    isInstalled: installedIds.has(integration.id),
  }));
}

export async function installIntegration(integrationId: string, tenantId: string | undefined | null, userId: string | undefined | null): Promise<void> { // Added return type
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!userId) throw new Error('User ID is required');

  // Check if already installed to prevent duplicates, though schema might enforce this
  const existingInstallation = await prisma.userIntegration.findFirst({
    where: {
      userId,
      tenantId,
      integrationId,
    },
  });

  if (existingInstallation) {
    // Optionally, you could throw an error or just return,
    // depending on desired behavior if trying to install an already installed integration.
    console.warn(`Integration ${integrationId} already installed for user ${userId} in tenant ${tenantId}.`);
    return; 
  }

  await prisma.userIntegration.create({
    data: {
      userId: userId, 
      tenantId: tenantId,
      integrationId: integrationId,
    },
  });
}
