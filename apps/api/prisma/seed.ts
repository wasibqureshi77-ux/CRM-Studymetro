import { PrismaClient, UserRole, LeadStatus, LeadSource, FollowupStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding process...');

  const tenantId = 'studymetro-global';
  const branchCode = 'METRO-LDN';
  const pass = 'Password123#';

  // 1. Clean existing records for clean seed
  console.log('🧹 Cleaning old mock records...');
  await prisma.notification.deleteMany({ where: { user: { tenantId } } });
  await prisma.activity.deleteMany({ where: { lead: { tenantId } } });
  await prisma.auditLog.deleteMany({ where: { tenantId } });
  await prisma.followup.deleteMany({ where: { lead: { tenantId } } });
  await prisma.leadDocument.deleteMany({ where: { lead: { tenantId } } });
  await prisma.studentProfile.deleteMany({ where: { lead: { tenantId } } });
  await prisma.note.deleteMany({ where: { lead: { tenantId } } });
  await prisma.lead.deleteMany({ where: { tenantId } });
  await prisma.userSession.deleteMany({ where: { user: { tenantId } } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.branch.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });

  // 2. Create Tenant
  console.log('🏢 Seeding Tenant: Study Metro Global...');
  await prisma.tenant.create({
    data: {
      id: tenantId,
      name: 'Study Metro Global',
      domain: 'studymetrojaipur.com',
      isActive: true,
    },
  });

  // 3. Create Branch
  console.log('📍 Seeding Branch: London HQ...');
  const branch = await prisma.branch.create({
    data: {
      tenantId,
      name: 'London HQ',
      code: branchCode,
      city: 'London',
      isActive: true,
    },
  });

  // 4. Create Users (SuperAdmin & Counsellor)
  console.log('👤 Seeding Users (SuperAdmin & Counsellor)...');
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(pass, salt);

  const superAdmin = await prisma.user.create({
    data: {
      tenantId,
      email: 'superadmin@studymetrojaipur.com',
      passwordHash,
      password: passwordHash,
      firstName: 'Sarah',
      lastName: 'SuperAdmin',
      fullName: 'Sarah SuperAdmin',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  const counsellor = await prisma.user.create({
    data: {
      tenantId,
      email: 'counsellor@studymetrojaipur.com',
      passwordHash,
      password: passwordHash,
      firstName: 'Jane',
      lastName: 'Counsellor',
      fullName: 'Jane Counsellor',
      role: UserRole.COUNSELLOR,
      isActive: true,
      designation: 'Counsellor',
    },
  });

  // 5. Create Student Leads
  console.log('👥 Seeding Student Leads & Academic Profiles...');
  const lead1 = await prisma.lead.create({
    data: {
      tenantId,
      branchId: branch.id,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@gmail.com',
      normalizedEmail: 'john.doe@gmail.com',
      phone: '+1234567890',
      normalizedPhone: '+1234567890',
      status: LeadStatus.NEW_LEAD,
      source: LeadSource.MANUAL,
      assigneeId: superAdmin.id,
      studentProfile: {
        create: {
          targetCountry: 'United Kingdom',
          targetCourse: 'MSc Data Science',
          intake: 'September 2026',
          ieltsStatus: 'BOOKED',
          passportStatus: 'VALID',
          educationLevel: 'Undergraduate',
          percentageGpa: '84%',
          budget: '£18,000',
          currentQualification: 'BSc Computer Science',
        },
      },
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      tenantId,
      branchId: branch.id,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@gmail.com',
      normalizedEmail: 'jane.smith@gmail.com',
      phone: '+1987654321',
      normalizedPhone: '+1987654321',
      status: LeadStatus.COUNSELLING,
      source: LeadSource.WEBSITE_SDK,
      assigneeId: superAdmin.id,
      studentProfile: {
        create: {
          targetCountry: 'Canada',
          targetCourse: 'MBA',
          intake: 'January 2027',
          ieltsStatus: 'TAKEN_PASSED',
          passportStatus: 'VALID',
          educationLevel: 'Undergraduate',
          percentageGpa: '3.6 GPA',
          budget: '$30,000 CAD',
          currentQualification: 'BBA Marketing',
        },
      },
    },
  });

  // Log creation activity
  await prisma.activity.createMany({
    data: [
      {
        leadId: lead1.id,
        actorId: superAdmin.id,
        type: 'LEAD_CREATED',
        description: 'Lead created manually via database seed',
      },
      {
        leadId: lead2.id,
        actorId: superAdmin.id,
        type: 'LEAD_CREATED',
        description: 'Lead created via website Telemetry tracking script',
      },
    ],
  });

  // 6. Create Followups
  console.log('📅 Seeding Followups agenda items...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.followup.createMany({
    data: [
      {
        leadId: lead1.id,
        assignedUserId: superAdmin.id,
        followupDate: tomorrow,
        status: FollowupStatus.SCHEDULED,
        notes: 'Review IELTS scores and send university catalog',
      },
      {
        leadId: lead2.id,
        assignedUserId: superAdmin.id,
        followupDate: twoDaysAgo,
        status: FollowupStatus.COMPLETED,
        notes: 'Initial counseling call: budget is clear',
      },
      {
        leadId: lead1.id,
        assignedUserId: superAdmin.id,
        followupDate: yesterday,
        status: FollowupStatus.MISSED,
        notes: 'Followup regarding passport application status',
      },
    ],
  });

  // 7. Seed WhatsApp Templates & Automations (Idempotent)
  console.log('💬 Seeding communication templates...');

  // Seed default Email Templates
  const emailTemplates = [
    { name: 'WELCOME', subject: 'Welcome to Study Metro!', body: 'Dear {{studentName}},\n\nWelcome to Study Metro!\n\nYour personalized Study Metro brochure:\n\n{{brochureLink}}\n\nReference ID: {{leadNumber}}\n\nRegards,\nStudy Metro Team', category: 'Lead' },
    { name: 'DOCUMENT_REQUEST', subject: 'Documents Required for Application', body: 'Dear {{studentName}},\n\nPlease upload the required documents to proceed with your application:\n{{pendingDocuments}}\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team', category: 'Documents' },
    { name: 'FOLLOWUP_REMINDER', subject: 'Followup Appointment Reminder', body: 'Dear {{studentName}},\n\nThis is a friendly reminder that you have a scheduled followup on {{followupDate}} with counsellor {{assignedCounsellor}}.\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team', category: 'Follow-up' },
    { name: 'VISA_APPROVED', subject: 'Visa Approved!', body: 'Dear {{studentName}},\n\nFantastic news! Your visa for {{country}} has been approved!\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team', category: 'Visa' },
    { name: 'OFFER_RECEIVED', subject: 'Offer Letter Received!', body: 'Dear {{studentName}},\n\nCongratulations! We have received an offer letter for your application to {{course}} in {{country}}.\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team', category: 'Admissions' }
  ];

  const emailMap: Record<string, string> = {};
  for (const t of emailTemplates) {
    let existing = await prisma.emailTemplate.findFirst({ where: { tenantId, name: t.name } });
    if (!existing) {
      existing = await prisma.emailTemplate.create({
        data: {
          tenantId,
          name: t.name,
          subject: t.subject,
          category: t.category,
          body: t.body,
          isActive: true
        }
      });
      await prisma.emailTemplateVersion.create({
        data: {
          templateId: existing.id,
          version: 1,
          subject: existing.subject,
          body: existing.body
        }
      });
    }
    emailMap[t.name] = existing.id;
  }

  // Seed default WhatsApp Templates
  const whatsappTemplates = [
    { name: 'WELCOME', body: 'Hello {{studentName}},\n\nWelcome to Study Metro!\n\nYour personalized Study Metro brochure:\n\n{{brochureLink}}\n\nReference ID: {{leadNumber}}\n\nRegards,\nStudy Metro Team', category: 'Lead' },
    { name: 'DOCUMENT_REQUEST', body: 'Hello {{studentName}}, please upload the required documents to proceed: {{pendingDocuments}}. Reference ID: {{leadNumber}}', category: 'Documents' },
    { name: 'FOLLOWUP_REMINDER', body: 'Hello {{studentName}}, reminder of your followup on {{followupDate}} with counsellor {{assignedCounsellor}}. Reference ID: {{leadNumber}}', category: 'Follow-up' },
    { name: 'VISA_APPROVED', body: 'Hello {{studentName}}, fantastic news! Your visa for {{country}} has been approved! 🎉 Reference ID: {{leadNumber}}', category: 'Visa' },
    { name: 'OFFER_RECEIVED', body: 'Hello {{studentName}}, congratulations! Offer letter received for {{course}} in {{country}}. Reference ID: {{leadNumber}}', category: 'Admissions' }
  ];

  const whatsappMap: Record<string, string> = {};
  for (const t of whatsappTemplates) {
    let existing = await prisma.whatsappTemplate.findFirst({ where: { tenantId, name: t.name } });
    if (!existing) {
      existing = await prisma.whatsappTemplate.create({
        data: {
          tenantId,
          name: t.name,
          category: t.category,
          body: t.body,
          message: t.body,
          isActive: true
        }
      });
      await prisma.whatsappTemplateVersion.create({
        data: {
          templateId: existing.id,
          version: 1,
          body: existing.body,
          message: existing.body
        }
      });
    }
    whatsappMap[t.name] = existing.id;
  }

  // Seed default SMS Templates (Stubs)
  const smsTemplates = [
    { name: 'WELCOME', body: 'Welcome to Study Metro! Reference ID: {{leadNumber}}' }
  ];
  const smsMap: Record<string, string> = {};
  for (const t of smsTemplates) {
    let existing = await prisma.smsTemplate.findFirst({ where: { tenantId, name: t.name } });
    if (!existing) {
      existing = await prisma.smsTemplate.create({
        data: {
          tenantId,
          name: t.name,
          category: 'Lead',
          body: t.body,
          isActive: true
        }
      });
      await prisma.smsTemplateVersion.create({
        data: {
          templateId: existing.id,
          version: 1,
          body: existing.body
        }
      });
    }
    smsMap[t.name] = existing.id;
  }

  // Seed default Automation Rules
  const defaultRules = [
    { name: 'Welcome Email Rule', trigger: 'LEAD_CREATED', channel: 'EMAIL', templateName: 'WELCOME' },
    { name: 'Welcome WhatsApp Rule', trigger: 'LEAD_CREATED', channel: 'WHATSAPP', templateName: 'WELCOME' },
    { name: 'Document Pending Email Rule', trigger: 'DOCUMENT_PENDING', channel: 'EMAIL', templateName: 'DOCUMENT_REQUEST' },
    { name: 'Document Pending WhatsApp Rule', trigger: 'DOCUMENT_PENDING', channel: 'WHATSAPP', templateName: 'DOCUMENT_REQUEST' },
    { name: 'Follow-up Session Email Rule', trigger: 'FOLLOWUP_REMINDER', channel: 'EMAIL', templateName: 'FOLLOWUP_REMINDER' },
    { name: 'Follow-up Session WhatsApp Rule', trigger: 'FOLLOWUP_REMINDER', channel: 'WHATSAPP', templateName: 'FOLLOWUP_REMINDER' },
    { name: 'Visa Approved Email Rule', trigger: 'VISA_APPROVED', channel: 'EMAIL', templateName: 'VISA_APPROVED' },
    { name: 'Visa Approved WhatsApp Rule', trigger: 'VISA_APPROVED', channel: 'WHATSAPP', templateName: 'VISA_APPROVED' },
    { name: 'Offer Letter Received Email Rule', trigger: 'OFFER_RECEIVED', channel: 'EMAIL', templateName: 'OFFER_RECEIVED' },
    { name: 'Offer Letter Received WhatsApp Rule', trigger: 'OFFER_RECEIVED', channel: 'WHATSAPP', templateName: 'OFFER_RECEIVED' }
  ];

  for (const r of defaultRules) {
    const existing = await prisma.automationRule.findFirst({
      where: { tenantId, trigger: r.trigger, channel: r.channel }
    });
    if (!existing) {
      const emailTemplateId = r.channel === 'EMAIL' ? emailMap[r.templateName] : null;
      const whatsappTemplateId = r.channel === 'WHATSAPP' ? whatsappMap[r.templateName] : null;

      await prisma.automationRule.create({
        data: {
          tenantId,
          name: r.name,
          trigger: r.trigger,
          channel: r.channel,
          emailTemplateId,
          whatsappTemplateId,
          delayType: 'IMMEDIATE',
          enabled: true
        }
      });
      console.log(`Created automation rule: ${r.name}`);
    }
  }

  console.log('✅ Seeding complete. All models populated successfully!');
  console.log('\nSeed Credentials:');
  console.log(`- SuperAdmin: ${superAdmin.email} / ${pass}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
