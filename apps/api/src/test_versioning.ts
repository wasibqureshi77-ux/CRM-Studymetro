import { LeadDocumentService } from './modules/document/lead-document.service';
import { LocalStorageProvider } from './common/storage/local-storage.provider';
import { NotificationService } from './modules/notification/notification.service';
import { PrismaService } from './prisma/prisma.service';
import { DocumentStatus } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaService();
const storageProvider = new LocalStorageProvider();
const notificationService = new NotificationService(prisma);
const mockCommunicationService = {
  enqueue: async () => ({})
} as any;
const service = new LeadDocumentService(prisma, notificationService, storageProvider, mockCommunicationService);

async function testVersioning() {
  console.log('🧪 Running Document Versioning & Expiry Unit Test...');

  const tenantId = 'studymetro-global';

  // Find or create admin user to avoid FK errors
  let admin = await prisma.user.findFirst({ where: { tenantId } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        id: 'system-admin-uuid',
        tenantId,
        email: 'system-admin@studymetrojaipur.com',
        firstName: 'System',
        lastName: 'Admin',
        passwordHash: 'dummy',
        role: 'SUPER_ADMIN'
      }
    });
  }

  const lead = await prisma.lead.create({
    data: {
      tenantId,
      firstName: 'Versioning',
      lastName: 'Tester',
      email: `test-ver-${Date.now()}@test.com`,
      phone: `999111${Math.floor(Math.random() * 10000)}`,
      leadCategory: 'IELTS',
      status: 'NEW_LEAD'
    }
  });

  // Ensure checklist generated
  await service.generateChecklist(lead.id, 'IELTS');

  // Create a mock Multer file
  const mockFileDir = path.resolve(process.cwd(), 'uploads', 'temp');
  if (!fs.existsSync(mockFileDir)) {
    fs.mkdirSync(mockFileDir, { recursive: true });
  }

  const tempFilePath = path.join(mockFileDir, 'test-passport.png');
  fs.writeFileSync(tempFilePath, 'mock data content');

  const mockFile = {
    fieldname: 'file',
    originalname: 'test-passport.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 100,
    destination: mockFileDir,
    filename: 'test-passport.png',
    path: tempFilePath,
    buffer: Buffer.from('mock data content'),
  } as Express.Multer.File;

  // 1. Upload Version 1
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 45); // Expires in 45 days
  const v1 = await service.uploadDocument(lead.id, 'Passport', mockFile, admin.id, expiryDate.toISOString());

  if (v1.version !== 1 || !v1.isCurrent || v1.status !== DocumentStatus.UPLOADED) {
    throw new Error(`Version 1 state incorrect: ${JSON.stringify(v1)}`);
  }
  console.log('   ✅ Uploaded Version 1 successfully.');

  // Create another file for version 2
  const tempFilePath2 = path.join(mockFileDir, 'test-passport-v2.png');
  fs.writeFileSync(tempFilePath2, 'mock data content version 2');
  mockFile.path = tempFilePath2;
  mockFile.originalname = 'test-passport-v2.png';

  // 2. Upload Version 2 (replace)
  const v2 = await service.uploadDocument(lead.id, 'Passport', mockFile, admin.id);

  if (v2.version !== 2 || !v2.isCurrent || v2.status !== DocumentStatus.UPLOADED) {
    throw new Error(`Version 2 state incorrect: ${JSON.stringify(v2)}`);
  }

  // Ensure Version 1 is marked as NOT current
  const oldV1 = await prisma.leadDocument.findUnique({ where: { id: v1.id } });
  if (oldV1?.isCurrent) {
    throw new Error('Version 1 was not marked as isCurrent = false when replaced.');
  }
  console.log('   ✅ Replaced with Version 2 successfully. Old version deactivated.');

  // 3. Check history
  const history = await service.getDocumentHistory(lead.id, 'Passport');
  if (history.length !== 2) {
    throw new Error(`Expected 2 items in history list, got ${history.length}`);
  }
  console.log('   ✅ Document history query returned exactly 2 records.');

  // 4. Verify Document Status Change
  await service.setDocumentStatus(v2.id, DocumentStatus.VERIFIED, admin.id);
  const verifiedDoc = await prisma.leadDocument.findUnique({ where: { id: v2.id } });
  if (verifiedDoc?.status !== DocumentStatus.VERIFIED) {
    throw new Error(`Expected status to be VERIFIED, got ${verifiedDoc?.status}`);
  }
  console.log('   ✅ Status updated to VERIFIED successfully.');

  // 5. Test Readiness Score calculation
  const score = await service.calculateReadiness(lead.id);
  // We have 3 required docs (ID Proof, Passport, Previous IELTS Score)
  // Only Passport is verified. Readiness Score should be 33%
  if (score !== 33) {
    throw new Error(`Expected readiness score to be 33%, got ${score}%`);
  }
  console.log('   ✅ Calculated readiness score is 33% (1/3 required documents verified).');

  // Clean up physical file
  if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  if (fs.existsSync(tempFilePath2)) fs.unlinkSync(tempFilePath2);

  console.log('🎉 Document Versioning, Status & Readiness Unit Test PASSED!');
}

testVersioning()
  .catch((e) => {
    console.error('💥 Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
