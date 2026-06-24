import { PrismaClient, CommunicationChannel, QueueStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function countEmails() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const count = await prisma.communicationLog.count({
    where: {
      channel: CommunicationChannel.EMAIL,
      status: QueueStatus.SENT,
      sentAt: {
        gte: oneDayAgo
      }
    }
  });

  console.log(`✉️ Total emails sent in last 24 hours: ${count}`);
}

countEmails().finally(() => prisma.$disconnect());
