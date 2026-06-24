import { PrismaClient, CommunicationChannel } from '@prisma/client';

const prisma = new PrismaClient();

async function runAudit() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  // Total SMTP send attempts (SENT + FAILED)
  const totalAttempts = await prisma.communicationLog.count({
    where: {
      channel: CommunicationChannel.EMAIL,
      sentAt: {
        gte: oneDayAgo
      }
    }
  });

  // Unique email recipients successfully sent to
  const uniqueRecipients = await prisma.communicationLog.groupBy({
    by: ['recipient'],
    where: {
      channel: CommunicationChannel.EMAIL,
      status: 'SENT',
      sentAt: {
        gte: oneDayAgo
      }
    }
  });

  console.log(`✉️ Total SMTP attempts in last 24 hours: ${totalAttempts}`);
  console.log(`👤 Total unique emails sent to in last 24 hours: ${uniqueRecipients.length}`);
}

runAudit().finally(() => prisma.$disconnect());
