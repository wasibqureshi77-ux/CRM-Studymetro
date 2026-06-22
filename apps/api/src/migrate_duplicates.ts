import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🔄 Starting Lead Deduplication & Submission History Migration...\n');

  // 1. Fetch all non-deleted leads with their related details
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null },
    include: {
      studentProfile: true,
      activities: { orderBy: { createdAt: 'desc' } },
      notes: true,
      documents: true,
      followups: true,
      submissions: true,
    },
    orderBy: { createdAt: 'asc' }, // oldest first
  });

  console.log(`📋 Found total ${leads.length} active leads in the system.`);

  // We will group duplicates by normalizedEmail and normalizedPhone
  const masterLeadsMap = new Map<string, typeof leads[0]>();
  const duplicatesToDelete = new Set<string>();

  for (const lead of leads) {
    const emailKey = lead.normalizedEmail ? `email:${lead.normalizedEmail}` : null;
    const phoneKey = lead.normalizedPhone ? `phone:${lead.normalizedPhone}` : null;

    let existingMaster = null;
    if (emailKey && masterLeadsMap.has(emailKey)) {
      existingMaster = masterLeadsMap.get(emailKey);
    } else if (phoneKey && masterLeadsMap.has(phoneKey)) {
      existingMaster = masterLeadsMap.get(phoneKey);
    }

    if (existingMaster) {
      // This lead is a duplicate of the existingMaster
      duplicatesToDelete.add(lead.id);

      console.log(`📍 Found Duplicate: Lead "${lead.firstName} ${lead.lastName}" (ID: ${lead.id}) matches Master "${existingMaster.firstName} ${existingMaster.lastName}" (ID: ${existingMaster.id})`);

      // Reparent Note records
      if (lead.notes.length > 0) {
        await prisma.note.updateMany({
          where: { leadId: lead.id },
          data: { leadId: existingMaster.id },
        });
      }

      // Reparent Document records
      if (lead.documents.length > 0) {
        await prisma.document.updateMany({
          where: { leadId: lead.id },
          data: { leadId: existingMaster.id },
        });
      }

      // Reparent Followup records
      if (lead.followups.length > 0) {
        await prisma.followup.updateMany({
          where: { leadId: lead.id },
          data: { leadId: existingMaster.id },
        });
      }

      // Reparent Activity records
      if (lead.activities.length > 0) {
        await prisma.activity.updateMany({
          where: { leadId: lead.id },
          data: { leadId: existingMaster.id },
        });
      }

      // Reparent any existing Submissions
      if (lead.submissions.length > 0) {
        await prisma.leadSubmission.updateMany({
          where: { leadId: lead.id },
          data: { leadId: existingMaster.id },
        });
      }

      // Create a LeadSubmission for this duplicate lead's original values
      const submitActivity = lead.activities.find((a) => a.type === 'FORM_SUBMITTED');
      const meta = (submitActivity?.meta as any) || {};

      await prisma.leadSubmission.create({
        data: {
          leadId: existingMaster.id,
          country: lead.studentProfile?.targetCountry || null,
          course: lead.studentProfile?.targetCourse || null,
          intake: lead.studentProfile?.intake || null,
          source: lead.source,
          utmSource: meta.utmSource || null,
          utmMedium: meta.utmMedium || null,
          utmCampaign: meta.utmCampaign || null,
          utmContent: meta.utmContent || null,
          utmTerm: meta.utmTerm || null,
          referrer: meta.referrer || null,
          landingPage: meta.landingPage || null,
          createdAt: lead.createdAt,
        },
      });

      // Update master's profile with duplicate's profile fields if master is missing them
      const masterProfile = existingMaster.studentProfile;
      const dupProfile = lead.studentProfile;
      if (dupProfile && masterProfile) {
        const updateFields: any = {};
        if (!masterProfile.targetCountry && dupProfile.targetCountry) updateFields.targetCountry = dupProfile.targetCountry;
        if (!masterProfile.targetCourse && dupProfile.targetCourse) updateFields.targetCourse = dupProfile.targetCourse;
        if (!masterProfile.intake && dupProfile.intake) updateFields.intake = dupProfile.intake;

        if (Object.keys(updateFields).length > 0) {
          await prisma.studentProfile.update({
            where: { leadId: existingMaster.id },
            data: updateFields,
          });
        }
      }

      // Increment master's submissionCount
      await prisma.lead.update({
        where: { id: existingMaster.id },
        data: {
          submissionCount: { increment: 1 },
        },
      });

      // Delete duplicate lead record
      await prisma.lead.delete({
        where: { id: lead.id },
      });

      console.log(`   ✅ Merged duplicate ID: ${lead.id} successfully!`);
    } else {
      // Register this lead as the master lead for these keys
      if (emailKey) masterLeadsMap.set(emailKey, lead);
      if (phoneKey) masterLeadsMap.set(phoneKey, lead);

      // Create a base LeadSubmission for the master lead's own initial state
      // (only if it doesn't already have one)
      if (lead.submissions.length === 0) {
        const submitActivity = lead.activities.find((a) => a.type === 'FORM_SUBMITTED');
        const meta = (submitActivity?.meta as any) || {};

        await prisma.leadSubmission.create({
          data: {
            leadId: lead.id,
            country: lead.studentProfile?.targetCountry || null,
            course: lead.studentProfile?.targetCourse || null,
            intake: lead.studentProfile?.intake || null,
            source: lead.source,
            utmSource: meta.utmSource || null,
            utmMedium: meta.utmMedium || null,
            utmCampaign: meta.utmCampaign || null,
            utmContent: meta.utmContent || null,
            utmTerm: meta.utmTerm || null,
            referrer: meta.referrer || null,
            landingPage: meta.landingPage || null,
            createdAt: lead.createdAt,
          },
        });
      }
    }
  }

  console.log(`\n🎉 Lead deduplication migration complete. Merged duplicate records: ${duplicatesToDelete.size}`);
}

runMigration()
  .catch((e) => {
    console.error('💥 Migration script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
