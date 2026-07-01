import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LeadService } from './modules/lead/lead.service';
import { CommunicationService } from './modules/communication/communication.service';
import { TrackerService } from './modules/tracker/tracker.service';
import { PrismaService } from './prisma/prisma.service';
import { CommunicationChannel, QueueStatus } from '@prisma/client';

async function runAudit() {
  console.log('🏁 Starting in-memory NestJS Application Context for Event-Driven Communication Audit...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const leadService = app.get(LeadService);
  const commService = app.get(CommunicationService);
  const trackerService = app.get(TrackerService);
  const prisma = app.get(PrismaService);

  const tenantId = 'studymetro-global';

  try {
    // 1. Clean existing logs
    console.log('🧹 Cleaning baseline communication logs...');
    await prisma.communicationLog.deleteMany();

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

    // Configure email settings to ensure both email and whatsapp are enabled
    await prisma.emailSetting.upsert({
      where: { tenantId },
      create: {
        tenantId,
        host: 'smtp.gmail.com',
        port: 587,
        username: 'test@studymetro.com',
        password: 'pass',
        senderName: 'Study Metro',
        senderEmail: 'test@studymetro.com',
        emailEnabled: true,
        whatsappEnabled: true
      },
      update: {
        emailEnabled: true,
        whatsappEnabled: true
      }
    });

    const sharedEmail = 'duplicate-enquiry@studymetrojaipur.com';
    const sharedPhone = '919998887776';

    console.log('\nTEST 1: Creating Lead #1 (Germany) with duplicate phone/email...');
    const lead1 = await prisma.lead.create({
      data: {
        tenantId,
        branchId: (await prisma.branch.findFirst({ where: { tenantId } }))!.id,
        firstName: 'Bob',
        lastName: 'Builder',
        email: sharedEmail,
        normalizedEmail: sharedEmail,
        phone: sharedPhone,
        normalizedPhone: sharedPhone,
        status: 'NEW_LEAD',
        leadCategory: 'STUDY_ABROAD',
        preferredCountry: 'Germany',
        preferredCourse: 'Masters in Engineering'
      }
    });

    const trackingToken1 = `token-bob1-${Date.now()}`;
    await prisma.brochureAssignment.create({
      data: {
        leadId: lead1.id,
        brochureId: brochure.id,
        token: trackingToken1,
        assignedBy: 'System'
      }
    });

    console.log(`Triggering welcome event for Lead #1...`);
    await commService.triggerEvent('LEAD_CREATED', lead1.id);

    console.log('\nTEST 2: Creating Lead #2 (Canada) with same duplicate phone/email...');
    const lead2 = await prisma.lead.create({
      data: {
        tenantId,
        branchId: (await prisma.branch.findFirst({ where: { tenantId } }))!.id,
        firstName: 'Bob',
        lastName: 'Builder',
        email: sharedEmail,
        normalizedEmail: sharedEmail,
        phone: sharedPhone,
        normalizedPhone: sharedPhone,
        status: 'NEW_LEAD',
        leadCategory: 'STUDY_ABROAD',
        preferredCountry: 'Canada',
        preferredCourse: 'MSc Computer Science'
      }
    });

    const trackingToken2 = `token-bob2-${Date.now()}`;
    await prisma.brochureAssignment.create({
      data: {
        leadId: lead2.id,
        brochureId: brochure.id,
        token: trackingToken2,
        assignedBy: 'System'
      }
    });

    console.log(`Triggering welcome event for Lead #2...`);
    await commService.triggerEvent('LEAD_CREATED', lead2.id);

    // Verify logs count to ensure both leads processed independently without suppression
    const logs1 = await prisma.communicationLog.findMany({ where: { leadId: lead1.id } });
    const logs2 = await prisma.communicationLog.findMany({ where: { leadId: lead2.id } });

    console.log(`- Lead #1: found ${logs1.length} communication logs.`);
    console.log(`- Lead #2: found ${logs2.length} communication logs.`);

    for (const log of [...logs1, ...logs2]) {
      console.log(`  - Lead ID: ${log.leadId}, Channel: ${log.channel}, Status: ${log.status}`);
      if (log.message.includes('{{studentName}}') || log.message.includes('{{brochureLink}}')) {
        throw new Error('❌ Verification FAILED: Unreplaced placeholders found in body!');
      }
    }

    if (logs1.length === 0 || logs2.length === 0) {
      throw new Error('❌ Verification FAILED: Duplicate email/phone suppression blocked communication on new lead!');
    }
    console.log('✓ TEST 1 & 2 PASSED: Shared phone/email leads processed and triggered independently.');

    // TEST 3: Status transition to DOCUMENTS_PENDING (maps to trigger DOCUMENT_PENDING)
    console.log('\nTEST 3: Transitioning Lead #1 status to DOCUMENTS_PENDING...');
    await prisma.leadDocument.create({
      data: {
        leadId: lead1.id,
        documentType: 'PASSPORT',
        status: 'PENDING',
        isCurrent: true,
        isRequired: true
      }
    });

    const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    await leadService.update(lead1.id, { status: 'DOCUMENTS_PENDING' }, tenantId, adminUser!.id);

    const docLogs = await prisma.communicationLog.findMany({
      where: { leadId: lead1.id, eventType: 'DOCUMENT_PENDING' }
    });

    console.log(`- Found ${docLogs.length} triggered logs for DOCUMENT_PENDING:`);
    for (const log of docLogs) {
      console.log(`  - Channel: ${log.channel}, Status: ${log.status}`);
      if (!log.message.includes('PASSPORT')) {
        throw new Error('❌ Verification FAILED: Pending documents checklist was not dynamically injected!');
      }
    }
    if (docLogs.length === 0) {
      throw new Error('❌ Verification FAILED: Status transition did not trigger welcome template!');
    }
    console.log('✓ TEST 3 PASSED: Status transition triggered document pending message with dynamic documents list.');

    // TEST 4: Duplicate prevention on same lead
    console.log('\nTEST 4: Simulating secondary status update to DOCUMENTS_PENDING (same lead)...');
    const docLogsBefore = await prisma.communicationLog.count({
      where: { leadId: lead1.id, eventType: 'DOCUMENT_PENDING' }
    });

    await leadService.update(lead1.id, { status: 'DOCUMENTS_PENDING' }, tenantId, adminUser!.id);

    const docLogsAfter = await prisma.communicationLog.count({
      where: { leadId: lead1.id, eventType: 'DOCUMENT_PENDING' }
    });

    console.log(`- Logs before: ${docLogsBefore}, Logs after: ${docLogsAfter}`);
    if (docLogsAfter !== docLogsBefore) {
      throw new Error('❌ Verification FAILED: Duplicate notification sent for same-status transition on same lead!');
    }
    console.log('✓ TEST 4 PASSED: Duplicate notifications blocked on same lead transition.');

    console.log('Waiting 10 seconds for Baileys socket disconnect/reconnect cycles to fully settle...');
    await new Promise(r => setTimeout(r, 10000));

    // TEST 5: Auto-captured visitor form tracking lead ingestion triggers Email + WhatsApp welcome event
    console.log('\nTEST 5: Waiting dynamically for active WhatsApp instance to become CONNECTED...');
    let connected = false;
    for (let i = 0; i < 60; i++) {
      const inst = await prisma.whatsappInstance.findFirst({
        where: { tenantId, status: 'CONNECTED' }
      });
      if (inst) {
        connected = true;
        console.log(`- WhatsApp Instance "${inst.instanceName}" is CONNECTED!`);
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    if (!connected) {
      console.warn('⚠️ Warning: WhatsApp instance did not connect in time. Continuing test...');
    }

    console.log('Submitting form visitor tracking lead auto-capture...');
    const visitorId = `visitor-test-${Date.now()}`;
    const sessionId = `session-test-${Date.now()}`;
    const trackResult = await trackerService.trackForm({
      visitorId,
      sessionId,
      formFields: {
        name: 'Alice Ingest',
        email: 'alice-ingest@studymetrojaipur.com',
        phone: '919998887771',
        leadCategory: 'Study Abroad'
      },
      url: 'http://localhost:5000'
    }, tenantId);

    const trackerLead = trackResult.lead;
    console.log(`- Generated Lead ID: ${trackerLead.id}`);

    const trackerLogs = await prisma.communicationLog.findMany({
      where: { leadId: trackerLead.id }
    });
    console.log(`- Found ${trackerLogs.length} triggered logs for auto-captured tracker lead:`);
    for (const log of trackerLogs) {
      console.log(`  - Channel: ${log.channel}, Status: ${log.status}`);
      if (log.message.includes('{{studentName}}') || log.message.includes('{{brochureLink}}')) {
        throw new Error('❌ Verification FAILED: Unreplaced placeholders found in tracker welcome body!');
      }
      if (!log.message.includes('Alice Ingest')) {
        throw new Error('❌ Verification FAILED: studentName was not replaced correctly in tracker welcome body!');
      }
    }
    if (trackerLogs.length < 2) {
      throw new Error('❌ Verification FAILED: Auto-captured lead failed to trigger both Email + WhatsApp welcome messages!');
    }
    console.log('✓ TEST 5 PASSED: Auto-captured lead triggered unified Email and WhatsApp welcome events correctly.');

  } catch (error: any) {
    console.error('❌ Audit Failed with error:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runAudit();
