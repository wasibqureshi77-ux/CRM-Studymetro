import { PrismaClient, Role, LeadStatus, LeadSource, CommunicationChannel, QueueStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function runVerification() {
  console.log('🏁 STARTING END-TO-END VERIFICATION PROGRAM...\n');

  const tenantId = 'studymetro-global';
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
        role: Role.SUPER_ADMIN
      }
    });
  }

  // Ensure we have an active brochure to assign
  console.log('📚 Checking / seeding mock brochure...');
  let brochure = await prisma.brochure.findFirst({
    where: { category: 'IELTS', isActive: true }
  });
  if (!brochure) {
    brochure = await prisma.brochure.create({
      data: {
        title: 'IELTS Master Brochure',
        category: 'IELTS',
        filePath: 'brochures/mock-ielts.pdf',
        totalPages: 4,
        isActive: true
      }
    });
  }

  // Write a mock physical PDF file so GET pdf doesn't 404
  const uploadDir = path.resolve(process.cwd(), 'uploads', 'brochures');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const physicalPdfPath = path.join(uploadDir, 'mock-ielts.pdf');
  if (!fs.existsSync(physicalPdfPath)) {
    fs.writeFileSync(physicalPdfPath, 'MOCK PDF DATA');
  }

  console.log(`   Brochure ID: ${brochure.id}, Title: ${brochure.title}`);

  // Clean old test leads
  console.log('\n🧹 Cleaning old test records...');
  const testEmail = 'verify-dedup-flow@studymetrojaipur.com';
  const testNormalizedEmail = 'verify-dedup-flow@studymetrojaipur.com';

  const oldLeads = await prisma.lead.findMany({
    where: {
      OR: [
        { email: testEmail },
        { normalizedEmail: testNormalizedEmail },
        { phone: '+919876543210' },
        { normalizedPhone: '9876543210' }
      ]
    }
  });

  for (const oldLead of oldLeads) {
    await prisma.leadSubmission.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.leadDocument.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.activity.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.brochureAssignment.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.communicationQueue.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.communicationLog.deleteMany({ where: { leadId: oldLead.id } });
    await prisma.lead.delete({ where: { id: oldLead.id } });
  }
  console.log('   Cleaned old records.');

  // Import LeadService manually for local testing
  const { LeadService } = require('./modules/lead/lead.service');
  const { LeadDocumentService } = require('./modules/document/lead-document.service');
  const { NotificationService } = require('./modules/notification/notification.service');
  const { LocalStorageProvider } = require('../src/common/storage/local-storage.provider');
  const { CommunicationService } = require('./modules/communication/communication.service');
  const { EmailService } = require('./modules/communication/email.service');
  const { BrochureService } = require('./modules/brochure/brochure.service');

  const notificationService = new NotificationService(prisma);
  const emailService = new EmailService(prisma);
  const commService = new CommunicationService(prisma, emailService);
  const storageProvider = new LocalStorageProvider();

  const docService = new LeadDocumentService(prisma, notificationService, storageProvider, commService);
  const leadService = new LeadService(prisma, docService, commService);
  const brochureService = new BrochureService(prisma, storageProvider);

  // Initialize templates
  await commService.seedTemplates();

  // VERIFICATION 1: Duplicate Leads Being Created
  console.log('\n🧪 VERIFICATION 1: Duplicate Leads & Phone Normalization');

  // Submit same lead payload 3 times with varying phone numbers
  const payloads = [
    {
      firstName: 'Deduplication',
      lastName: 'Tester',
      email: testEmail,
      phone: '+91 9876543210',
      leadCategory: 'IELTS',
      source: LeadSource.MANUAL
    },
    {
      firstName: 'Deduplication Latest',
      lastName: 'Tester',
      email: testEmail,
      phone: '9876543210',
      leadCategory: 'IELTS',
      source: LeadSource.MANUAL
    },
    {
      firstName: 'Deduplication Final',
      lastName: 'Tester',
      email: testEmail,
      phone: '91-9876543210',
      leadCategory: 'IELTS',
      source: LeadSource.MANUAL
    }
  ];

  console.log('👉 Submitting form payload 1...');
  const lead1 = await leadService.create(payloads[0], tenantId, admin.id);
  console.log(`   Lead 1 ID: ${lead1.id}, SubmissionCount: ${lead1.submissionCount}`);

  console.log('👉 Submitting form payload 2...');
  const lead2 = await leadService.create(payloads[1], tenantId, admin.id);
  console.log(`   Lead 2 ID: ${lead2.id}, SubmissionCount: ${lead2.submissionCount}`);

  console.log('👉 Submitting form payload 3...');
  const lead3 = await leadService.create(payloads[2], tenantId, admin.id);
  console.log(`   Lead 3 ID: ${lead3.id}, SubmissionCount: ${lead3.submissionCount}`);

  // DB Checks for deduplication
  const dbLeads = await prisma.lead.findMany({
    where: { normalizedEmail: testNormalizedEmail }
  });

  console.log(`\n📊 Lead Count in DB: ${dbLeads.length} (Expected: 1)`);
  if (dbLeads.length !== 1) {
    throw new Error(`Deduplication FAILED. Lead Count is ${dbLeads.length}`);
  }

  const finalLead = await prisma.lead.findUnique({
    where: { id: dbLeads[0].id },
    include: { submissions: true }
  });

  console.log(`📊 Lead submissionCount: ${finalLead?.submissionCount} (Expected: 3)`);
  console.log(`📊 LeadSubmission Records Count: ${finalLead?.submissions.length} (Expected: 3)`);

  if (finalLead?.submissionCount !== 3 || finalLead?.submissions.length !== 3) {
    throw new Error('Deduplication stats incorrect');
  }

  // VERIFICATION 2: Welcome Workflow Correctness
  console.log('\n🧪 VERIFICATION 2: Welcome Workflow & Document Request triggers');

  const commQueueItems = await prisma.communicationQueue.findMany({
    where: { leadId: finalLead.id }
  });

  console.log('✉️ Queued Communications:');
  for (const item of commQueueItems) {
    console.log(`   - Event: ${item.eventType}, Channel: ${item.channel}`);
  }

  // Welcome flow should only trigger: WELCOME and BROCHURE
  const eventTypes = commQueueItems.map(item => item.eventType);
  const welcomeCount = eventTypes.filter(t => t === 'WELCOME').length;
  const brochureCount = eventTypes.filter(t => t === 'BROCHURE').length;
  const docReqCount = eventTypes.filter(t => t === 'DOCUMENT_REQUEST').length;

  console.log(`📊 WELCOME Event Count: ${welcomeCount} (Expected: 1)`);
  console.log(`📊 BROCHURE Event Count: ${brochureCount} (Expected: 1)`);
  console.log(`📊 DOCUMENT_REQUEST Event Count on Creation: ${docReqCount} (Expected: 0)`);

  if (welcomeCount !== 1 || brochureCount !== 1 || docReqCount !== 0) {
    throw new Error('Welcome workflow enqueued incorrect items on lead creation');
  }

  // Test manual missing documents request
  console.log('\n👉 Simulating Counsellor clicking "Request Missing Documents"...');
  await docService.requestMissingDocuments(finalLead.id, admin.id);

  const afterManualCommQueue = await prisma.communicationQueue.findMany({
    where: { leadId: finalLead.id, eventType: 'DOCUMENT_REQUEST' }
  });
  console.log(`📊 DOCUMENT_REQUEST Event Count after manual request: ${afterManualCommQueue.length} (Expected: 2)`);
  if (afterManualCommQueue.length !== 2) {
    throw new Error('Manual document request did not trigger communications');
  }

  // Test status change to DOCUMENTS_PENDING (Prisma schema: LeadStatus.DOCUMENTS_PENDING)
  console.log('\n👉 Changing Lead Status to DOCUMENTS_PENDING...');
  await leadService.update(finalLead.id, { status: LeadStatus.DOCUMENTS_PENDING }, tenantId, admin.id);

  const afterStatusChangeQueue = await prisma.communicationQueue.findMany({
    where: { leadId: finalLead.id, eventType: 'DOCUMENT_REQUEST' }
  });
  console.log(`📊 DOCUMENT_REQUEST Event Count after status change: ${afterStatusChangeQueue.length} (Expected: 4)`);
  if (afterStatusChangeQueue.length !== 4) {
    throw new Error('Status change to DOCUMENTS_PENDING did not trigger communications');
  }

  // VERIFICATION 3: Brochure Tracking Validation
  console.log('\n🧪 VERIFICATION 3: Brochure Tracking & Milestones');

  const assignments = await brochureService.getLeadAssignments(finalLead.id);
  if (assignments.length === 0) {
    throw new Error('No brochure assigned to lead');
  }

  const token = assignments[0].token;
  const API_URL = 'http://localhost:4000';
  console.log(`👉 Simulating Lead opening brochure via public HTTP GET (token: ${token})...`);

  // Test GET view
  const viewRes = await fetch(`${API_URL}/api/v1/brochure/view/${token}`);
  if (!viewRes.ok) {
    throw new Error(`Public view endpoint failed: ${viewRes.status} - ${await viewRes.text()}`);
  }
  const viewData = await viewRes.json();
  console.log(`   Fetched brochure metadata successfully! Title: ${viewData.brochure.title}`);

  // Test POST event - OPEN
  console.log('👉 Simulating Open event via public HTTP POST...');
  const openRes = await fetch(`${API_URL}/api/v1/brochure/event/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'OPEN' })
  });
  if (!openRes.ok) {
    throw new Error(`Public open event endpoint failed: ${openRes.status}`);
  }
  let res = await openRes.json();
  console.log(`   Open event registered! Score: ${res.tracking.engagementScore}, Label: ${res.leadEngagementLabel}`);

  // Test POST Page Views
  console.log('👉 Simulating Page Views via public HTTP POST...');
  for (let page = 1; page <= 4; page++) {
    const pvRes = await fetch(`${API_URL}/api/v1/brochure/event/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'PAGE_VIEW', payload: { pageNumber: page } })
    });
    if (!pvRes.ok) throw new Error(`Public page view event failed for page ${page}`);
    res = await pvRes.json();
    console.log(`   Page ${page} view registered. Completion: ${res.tracking.completionPercentage}%`);
  }

  // Test POST Download
  console.log('👉 Simulating Download event via public HTTP POST...');
  const dlRes = await fetch(`${API_URL}/api/v1/brochure/event/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType: 'DOWNLOAD' })
  });
  if (!dlRes.ok) throw new Error('Public download event failed');
  res = await dlRes.json();
  console.log(`   Download event registered. Score: ${res.tracking.engagementScore}, Label: ${res.leadEngagementLabel}`);

  // Test GET PDF
  console.log('👉 Fetching brochure PDF binary via public HTTP GET...');
  const pdfRes = await fetch(`${API_URL}/api/v1/brochure/pdf/${token}`);
  if (!pdfRes.ok) {
    throw new Error(`Public pdf endpoint failed: ${pdfRes.status}`);
  }
  console.log(`   PDF content fetched successfully! Length: ${pdfRes.headers.get('content-length')} bytes`);

  // Verify activity timeline and transitions
  const timeline = await leadService.getTimeline(finalLead.id, tenantId);
  const timelineTypes = timeline.map((t: any) => t.data.type);

  console.log('\n📊 Activity Timeline logs found:');
  for (const item of timeline) {
    if (item.type === 'activity') {
      console.log(`   - [${item.date.toISOString()}] ${item.data.type}: ${item.data.description}`);
    }
  }

  const requiredMilestones = [
    'BROCHURE_SENT',
    'BROCHURE_OPENED',
    'BROCHURE_VIEWED_50',
    'BROCHURE_COMPLETED',
    'BROCHURE_DOWNLOADED'
  ];

  console.log('\n🔍 Milestone Event Checks:');
  for (const m of requiredMilestones) {
    const passed = timelineTypes.includes(m);
    console.log(`   - [${passed ? '✓ PASSED' : '✗ FAILED'}] Milestone ${m}`);
    if (!passed) throw new Error(`Missing milestone activity: ${m}`);
  }

  console.log(`\n🏆 Lead Label Transition: ${res.leadEngagementLabel} (Expected: Hot)`);
  if (res.leadEngagementLabel !== 'Hot') {
    throw new Error(`Engagement label transition failed. Expected Hot, got ${res.leadEngagementLabel}`);
  }

  console.log('\n🎉 ALL END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

runVerification()
  .catch(err => {
    console.error('\n💥 Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
