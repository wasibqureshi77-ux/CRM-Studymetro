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
  console.log('💬 Seeding WhatsApp templates & automations...');

  const templatesToSeed = [
    {
      name: 'Welcome Template',
      message: 'Hello {{name}}, welcome to Study Metro! We received your registration. Your Lead Number is {{leadNumber}}.',
      variables: ['name', 'leadNumber']
    },
    {
      name: 'Document Pending Template',
      message: 'Hello {{name}}, some documents are still pending for your application. Please upload them as soon as possible.',
      variables: ['name']
    },
    {
      name: 'Followup Reminder Template',
      message: 'Hello {{name}}, this is a reminder for your upcoming counselling session scheduled for {{followupDate}}.',
      variables: ['name', 'followupDate']
    }
  ];

  const templateMap: Record<string, string> = {};

  for (const t of templatesToSeed) {
    let existing = await prisma.whatsappTemplate.findFirst({
      where: { tenantId, name: t.name }
    });

    if (!existing) {
      existing = await prisma.whatsappTemplate.create({
        data: {
          tenantId,
          name: t.name,
          message: t.message,
          variables: t.variables,
          isActive: true
        }
      });
      console.log(`Created template: ${t.name}`);
    } else {
      console.log(`Template already exists, skipping: ${t.name}`);
    }
    templateMap[t.name] = existing.id;
  }

  const automationsToSeed = [
    { trigger: 'LEAD_CREATED', templateName: 'Welcome Template' },
    { trigger: 'DOCUMENT_PENDING', templateName: 'Document Pending Template' },
    { trigger: 'FOLLOWUP_REMINDER', templateName: 'Followup Reminder Template' }
  ];

  for (const auto of automationsToSeed) {
    const existingAuto = await prisma.whatsappAutomation.findFirst({
      where: { tenantId, trigger: auto.trigger }
    });

    if (!existingAuto) {
      await prisma.whatsappAutomation.create({
        data: {
          tenantId,
          trigger: auto.trigger,
          templateId: templateMap[auto.templateName],
          enabled: true
        }
      });
      console.log(`Created automation rule: ${auto.trigger}`);
    } else {
      console.log(`Automation rule already exists, skipping: ${auto.trigger}`);
    }
  }

  // 8. Seed Multi-Channel Enterprise Communication Automations (Idempotent)
  console.log('⚡ Seeding Enterprise Communication Automations...');

  const commTemplatesToSeed = [
    {
      name: 'Welcome Message Template',
      subject: 'Welcome to Study Metro!',
      body: 'Hello {{studentName}},\n\nWelcome to Study Metro Jaipur.\n\nLead Number:\n{{leadNumber}}\n\nPlease review your personalised brochure before our counselling session.\n\n📘 {{brochureTitle}}\n\n{{brochureLink}}\n\nYou can also access your Student Portal:\n\n{{portalLink}}\n\nRegards\nStudy Metro Jaipur',
      variables: ['studentName', 'leadNumber', 'brochureTitle', 'brochureLink', 'portalLink']
    },
    {
      name: 'Brochure Shared Template',
      subject: 'Your Brochure Download Link',
      body: 'Hello {{studentName}},\n\nHere is your requested brochure:\n📘 {{brochureTitle}}\n{{brochureLink}}',
      variables: ['studentName', 'brochureTitle', 'brochureLink']
    },
    {
      name: 'Student Portal Activated Template',
      subject: 'Your Student Portal Access',
      body: 'Hello {{studentName}},\n\nyour student portal account is ready. Access it here:\n{{portalLink}}',
      variables: ['studentName', 'portalLink']
    },
    {
      name: 'Document Pending Reminder Template',
      subject: 'Pending Documents Checklist Reminder',
      body: 'Hello {{studentName}}\n\nThe following documents are still pending.\n\n{{pendingDocuments}}\n\nUpload them here:\n\n{{portalLink}}',
      variables: ['studentName', 'pendingDocuments', 'portalLink']
    },
    {
      name: 'Follow-up Session Reminder Template',
      subject: 'Counselling Followup Reminder',
      body: 'Hello {{studentName}}\n\nReminder\n\nYour counselling session is scheduled for\n\n{{followupDate}}',
      variables: ['studentName', 'followupDate']
    },
    {
      name: 'Offer Letter Received Template',
      subject: 'Congratulations! Offer Letter Received',
      body: 'Hello {{studentName}},\n\nyou have received an offer letter for {{course}} in {{country}}.',
      variables: ['studentName', 'course', 'country']
    },
    {
      name: 'Visa Approved Template',
      subject: 'Visa Request Approved!',
      body: 'Hello {{studentName}},\n\nyour study visa application has been approved. Visa Status: {{visaStatus}}',
      variables: ['studentName', 'visaStatus']
    }
  ];

  const commTemplateMap: Record<string, string> = {};

  for (const ct of commTemplatesToSeed) {
    let existing = await prisma.communicationAutomationTemplate.findFirst({
      where: { tenantId, name: ct.name }
    });

    if (!existing) {
      existing = await prisma.communicationAutomationTemplate.create({
        data: {
          tenantId,
          name: ct.name,
          subject: ct.subject,
          body: ct.body,
          variables: ct.variables,
          isActive: true
        }
      });
      console.log(`Created communication template: ${ct.name}`);
    } else {
      console.log(`Communication template already exists, skipping: ${ct.name}`);
    }
    commTemplateMap[ct.name] = existing.id;
  }

  const commAutomationsToSeed = [
    { name: 'Lead Created Welcome Automation', trigger: 'LEAD_CREATED', templateName: 'Welcome Message Template', channels: ['WHATSAPP', 'EMAIL'] },
    { name: 'Brochure Shared Automation', trigger: 'BROCHURE_SHARED', templateName: 'Brochure Shared Template', channels: ['WHATSAPP', 'EMAIL'] },
    { name: 'Student Portal Activated Automation', trigger: 'PORTAL_ACTIVATED', templateName: 'Student Portal Activated Template', channels: ['WHATSAPP', 'EMAIL'] },
    { name: 'Document Reminder Automation', trigger: 'DOCUMENT_PENDING', templateName: 'Document Pending Reminder Template', channels: ['WHATSAPP'] },
    { name: 'Follow-up Session Reminder Automation', trigger: 'FOLLOWUP_REMINDER', templateName: 'Follow-up Session Reminder Template', channels: ['WHATSAPP'] },
    { name: 'Offer Letter Received Automation', trigger: 'OFFER_RECEIVED', templateName: 'Offer Letter Received Template', channels: ['WHATSAPP', 'EMAIL'] },
    { name: 'Visa Approved Automation', trigger: 'VISA_APPROVED', templateName: 'Visa Approved Template', channels: ['WHATSAPP', 'EMAIL'] }
  ];

  for (const ca of commAutomationsToSeed) {
    const existingAuto = await prisma.communicationAutomation.findFirst({
      where: { tenantId, name: ca.name }
    });

    if (!existingAuto) {
      await prisma.communicationAutomation.create({
        data: {
          tenantId,
          name: ca.name,
          trigger: ca.trigger,
          channels: ca.channels,
          templateId: commTemplateMap[ca.templateName],
          delayType: 'IMMEDIATE',
          enabled: true
        }
      });
      console.log(`Created communication automation rule: ${ca.name}`);
    } else {
      console.log(`Communication automation rule already exists, skipping: ${ca.name}`);
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
