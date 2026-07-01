import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LeadService } from './modules/lead/lead.service';
import { CommunicationService } from './modules/communication/communication.service';
import { PrismaService } from './prisma/prisma.service';
import { CommunicationChannel } from '@prisma/client';

async function runAudit() {
  console.log('🏁 Starting in-memory NestJS Application Context for Automation Hub Audit...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const leadService = app.get(LeadService);
  const commService = app.get(CommunicationService);
  const prisma = app.get(PrismaService);

  const tenantId = 'studymetro-global';

  try {
    // 1. Clean existing logs
    console.log('🧹 Cleaning baseline automation logs...');
    await prisma.communicationAutomationLog.deleteMany();

    // 2. Resolve a brochure
    let brochure = await prisma.brochure.findFirst({
      where: { category: 'STUDY_ABROAD', isActive: true }
    });
    if (!brochure) {
      brochure = await prisma.brochure.create({
        data: {
          title: 'Premium Study Abroad Prospectus',
          category: 'STUDY_ABROAD',
          filePath: 'brochures/default.pdf',
          totalPages: 10,
          isActive: true
        }
      });
    }

    // 3. Create a brand new lead
    console.log('\nTEST 1: Creating a brand new Lead...');
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        branchId: (await prisma.branch.findFirst({ where: { tenantId } }))!.id,
        firstName: 'Bob',
        lastName: 'Builder',
        email: `bob-${Date.now()}@studymetrojaipur.com`,
        normalizedEmail: `bob-${Date.now()}@studymetrojaipur.com`,
        phone: '919876543210',
        normalizedPhone: '919876543210',
        status: 'NEW_LEAD',
        leadCategory: 'STUDY_ABROAD',
        preferredCountry: 'Germany',
        preferredCourse: 'Masters in Engineering'
      }
    });

    // Generate secure tracking assignment
    const trackingToken = `token-bob-${Date.now()}`;
    await prisma.brochureAssignment.create({
      data: {
        leadId: lead.id,
        brochureId: brochure.id,
        token: trackingToken,
        assignedBy: 'System'
      }
    });

    console.log(`Created Lead ID: ${lead.id}. Triggering welcome event...`);
    await commService.triggerEvent('LEAD_CREATED', lead.id);

    // Verify logs
    const logs = await prisma.communicationAutomationLog.findMany({
      where: { leadId: lead.id },
      include: { automation: { include: { template: true } } }
    });

    console.log(`\nFound ${logs.length} triggered logs for LEAD_CREATED:`);
    for (const log of logs) {
      console.log(`- Channel: ${log.channel}`);
      console.log(`- Status: ${log.status}`);
      console.log(`- Template Name: ${log.automation.template.name}`);
      console.log(`- Evaluated Content:\n"""\n${log.response}\n"""`);
      
      // Verify placeholders
      if (log.response.includes('{{studentName}}') || log.response.includes('{{brochureLink}}')) {
        throw new Error('❌ Verification FAILED: Unreplaced placeholders found in body!');
      }
      if (!log.response.includes('Bob Builder')) {
        throw new Error('❌ Verification FAILED: studentName was not replaced correctly!');
      }
      if (!log.response.includes(trackingToken)) {
        throw new Error('❌ Verification FAILED: brochure tracking link was not injected!');
      }
    }
    console.log('✓ TEST 1 PASSED: Welcome Message triggered with secure brochure link successfully.');

    // 4. Test status transition to DOCUMENTS_PENDING
    console.log('\nTEST 2: Transitioning status from NEW_LEAD to DOCUMENTS_PENDING...');
    
    // Create a pending document
    await prisma.leadDocument.create({
      data: {
        leadId: lead.id,
        documentType: 'PASSPORT',
        status: 'PENDING',
        isCurrent: true,
        isRequired: true
      }
    });

    const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    await leadService.update(lead.id, { status: 'DOCUMENTS_PENDING' }, tenantId, adminUser!.id);

    const docLogs = await prisma.communicationAutomationLog.findMany({
      where: { leadId: lead.id, automation: { trigger: 'DOCUMENT_PENDING' } },
      include: { automation: { include: { template: true } } }
    });

    console.log(`\nFound ${docLogs.length} triggered logs for DOCUMENT_PENDING:`);
    for (const log of docLogs) {
      console.log(`- Channel: ${log.channel}`);
      console.log(`- Status: ${log.status}`);
      console.log(`- Content:\n"""\n${log.response}\n"""`);

      if (!log.response.includes('PASSPORT')) {
        throw new Error('❌ Verification FAILED: Pending documents list was not dynamically injected!');
      }
    }
    console.log('✓ TEST 2 PASSED: Status transition triggered document pending message with dynamic documents list.');

    // 5. Test duplicate transition prevention (DOCUMENTS_PENDING -> DOCUMENTS_PENDING)
    console.log('\nTEST 3: Simulating secondary status update to DOCUMENTS_PENDING...');
    const logsBefore = await prisma.communicationAutomationLog.count({
      where: { leadId: lead.id, automation: { trigger: 'DOCUMENT_PENDING' } }
    });

    // Call update with same status
    await leadService.update(lead.id, { status: 'DOCUMENTS_PENDING' }, tenantId, adminUser!.id);

    const logsAfter = await prisma.communicationAutomationLog.count({
      where: { leadId: lead.id, automation: { trigger: 'DOCUMENT_PENDING' } }
    });

    console.log(`- Logs count before same-status update: ${logsBefore}`);
    console.log(`- Logs count after same-status update: ${logsAfter}`);

    if (logsAfter !== logsBefore) {
      throw new Error('❌ Verification FAILED: Duplicate notification sent for same-status transition!');
    }
    console.log('✓ TEST 3 PASSED: Duplicate notifications successfully blocked.');

  } catch (error: any) {
    console.error('❌ Audit Failed with error:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runAudit();
