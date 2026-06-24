import { PrismaService } from './prisma/prisma.service';
import { CommunicationService } from './modules/communication/communication.service';
import { EmailService } from './modules/communication/email.service';

const prisma = new PrismaService();

async function runMigration() {
  console.log('🏁 STARTING LEAD REFERENCE ID MIGRATION...\n');

  // 1. Fetch all leads sorted by createdAt ascending
  const leads = await prisma.lead.findMany({
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`Found ${leads.length} total leads to process.`);

  let updatedCount = 0;
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const sequenceNum = (i + 1).toString().padStart(4, '0');
    const leadNumber = `SM${sequenceNum}`;

    console.log(`Migrating lead ${lead.id} (${lead.firstName || 'No Name'}) -> ${leadNumber}`);
    
    await prisma.lead.update({
      where: { id: lead.id },
      data: { leadNumber },
    });
    
    updatedCount++;
  }

  console.log(`\n✓ Migrated ${updatedCount} leads successfully.`);

  // 2. Run seedTemplates to re-initialize communication templates with new format
  console.log('\n🌱 Seeding communication templates...');
  const emailService = new EmailService(prisma);
  const commService = new CommunicationService(prisma, emailService);
  await commService.seedTemplates();
  console.log('✓ Seeding complete.');

  console.log('\n🏁 MIGRATION COMPLETED SUCCESSFULLY!');
}

runMigration()
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.onModuleDestroy();
  });
