import { PrismaClient, Role, LeadStatus, LeadSource, FollowupStatus } from '@prisma/client';
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
  await prisma.document.deleteMany({ where: { lead: { tenantId } } });
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
      domain: 'studymetro.com',
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

  // 4. Create Users (SuperAdmin Only)
  console.log('👤 Seeding Users (SuperAdmin Only for Single User Mode)...');
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(pass, salt);

  const superAdmin = await prisma.user.create({
    data: {
      tenantId,
      email: 'superadmin@studymetro.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'SuperAdmin',
      role: Role.SUPER_ADMIN,
      isActive: true,
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
      status: LeadStatus.NEW,
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
