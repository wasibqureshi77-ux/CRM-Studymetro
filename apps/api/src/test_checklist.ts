import { PrismaClient } from '@prisma/client';
import { LeadDocumentService } from './modules/document/lead-document.service';
import { LocalStorageProvider } from './common/storage/local-storage.provider';
import { NotificationService } from './modules/notification/notification.service';
import { PrismaService } from './prisma/prisma.service';

const prisma = new PrismaService();
const storageProvider = new LocalStorageProvider();
const notificationService = new NotificationService(prisma);
const mockCommunicationService = {
  enqueue: async () => ({})
} as any;
const service = new LeadDocumentService(prisma, notificationService, storageProvider, mockCommunicationService);

async function testChecklist() {
  console.log('🧪 Running Document Checklist Generation Unit Test...');

  // Create a mock tenant, branch, and user if not exists
  const tenantId = 'studymetro-global';
  const branchId = 'london-hq';
  
  // Clean or find existing
  let tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { id: tenantId, name: 'Study Metro Global', domain: 'studymetro.com' } });
  }

  // Create dummy lead
  const lead = await prisma.lead.create({
    data: {
      tenantId,
      firstName: 'Test',
      lastName: 'Document Student',
      email: `test-docs-${Date.now()}@test.com`,
      phone: `999000${Math.floor(Math.random() * 10000)}`,
      leadCategory: 'IELTS',
      status: 'NEW_LEAD'
    }
  });

  console.log(`Created test lead with ID: ${lead.id} under category: IELTS`);

  // Generate checklist
  const createdDocs = await service.generateChecklist(lead.id, 'IELTS');
  console.log(`Generated ${createdDocs.length} checklist items for IELTS`);

  // We expect: ID Proof (Required), Passport (Required), Previous IELTS Score (Required)
  const docs = await prisma.leadDocument.findMany({
    where: { leadId: lead.id, isCurrent: true }
  });

  const expectedTypes = ['ID Proof', 'Passport', 'Previous IELTS Score'];
  for (const type of expectedTypes) {
    const doc = docs.find((d) => d.documentType === type);
    if (!doc) {
      throw new Error(`Missing expected document checklist item: ${type}`);
    }
    if (!doc.isRequired) {
      throw new Error(`Expected ${type} to be required`);
    }
    console.log(`   ✅ Validated checklist item: ${type} is present and required.`);
  }

  // Verify readiness score is 0% initially
  const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
  if (updatedLead?.readinessScore !== 0) {
    throw new Error(`Expected initial readiness score to be 0, got ${updatedLead?.readinessScore}`);
  }
  console.log('   ✅ Initial readiness score is 0% as expected.');

  console.log('🎉 Document Checklist Generation Unit Test PASSED!');
}

testChecklist()
  .catch((e) => {
    console.error('💥 Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
