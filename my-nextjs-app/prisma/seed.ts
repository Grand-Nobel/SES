// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  const tenantName = 'Default Tenant';
  let tenant = await prisma.tenant.findFirst({
    where: { name: tenantName },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: tenantName },
    });
    console.log(`Created tenant with id: ${tenant.id} and name: ${tenant.name}`);
  } else {
    console.log(`Tenant "${tenantName}" already exists with id: ${tenant.id}`);
  }

  const userEmail = 'user@example.com';
  let existingUser = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!existingUser) {
    const hashedPassword = await hash('password', 10);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: userEmail,
        password: hashedPassword,
        name: 'Test User',
        image: 'https://via.placeholder.com/150/0000FF/808080?Text=User',
        emailVerified: new Date(), // Mark email as verified for simplicity
      },
    });
    console.log(`Created user with id: ${user.id}, email: ${user.email}`);
  } else {
    console.log(`User with email "${userEmail}" already exists.`);
  }

  // Seed Integrations
  const integrationsToSeed = [
    { name: 'Stripe', description: 'Payment integration for processing transactions.', category: 'Finance', icon: 'https://w7.pngwing.com/pngs/100/496/png-transparent-stripe-logo-thumbnail.png' },
    { name: 'Slack', description: 'Team communication and collaboration platform.', category: 'Communication', icon: 'https://cdn.icon-icons.com/icons2/2699/PNG/512/slack_logo_icon_170229.png' },
    { name: 'Salesforce', description: 'CRM platform for sales, service, and marketing.', category: 'CRM', icon: 'https://cdn.icon-icons.com/icons2/2699/PNG/512/salesforce_logo_icon_169491.png' },
    { name: 'HubSpot', description: 'Marketing, sales, and service software.', category: 'Marketing', icon: 'https://cdn.icon-icons.com/icons2/2699/PNG/512/hubspot_logo_icon_169 HubSpot_logo_icon_169296.png' }, // Corrected icon name
  ];

  for (const intData of integrationsToSeed) {
    let existingIntegration = await prisma.integration.findFirst({
        where: { name: intData.name }
    });
    if (!existingIntegration) {
        await prisma.integration.create({
            data: intData,
        });
        console.log(`Created integration: ${intData.name}`);
    } else {
        console.log(`Integration "${intData.name}" already exists.`);
    }
  }

  console.log(`Seeding finished.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
