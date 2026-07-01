import { Queue, Worker, Job } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { WhatsappGatewayService } from '../gateway/whatsapp.gateway';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WhatsappQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue;
  private worker: Worker;
  private readonly logger = new Logger(WhatsappQueueService.name);
  public static instance: WhatsappQueueService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: WhatsappGatewayService
  ) {
    WhatsappQueueService.instance = this;
  }

  private isRedisAvailable = true;

  async onModuleInit() {
    const redisOptions = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy(times: number) {
        if (times > 2) {
          return null; // Stop retrying quickly to switch to fallback mode
        }
        return 1000;
      }
    };

    // Configure BullMQ Queue gracefully
    this.queue = new Queue('whatsapp-outbox', {
      connection: redisOptions,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      }
    });

    this.queue.on('error', (err) => {
      this.isRedisAvailable = false;
      this.logger.warn(`[Whatsapp] BullMQ Queue Offline (Redis Unavailable): ${err.message}. Falling back to database-backed synchronous messaging.`);
    });

    // Configure BullMQ Worker to process outbox messages
    this.worker = new Worker(
      'whatsapp-outbox',
      async (job: Job) => {
        const { messageId, to, content, instanceId } = job.data;
        this.logger.log(`[Whatsapp] Processing outbound message job: ${job.id} for messageId: ${messageId}`);

        // Update to PROCESSING status
        await this.prisma.whatsappMessage.update({
          where: { id: messageId },
          data: { status: 'PROCESSING' }
        });

        try {
          const sendResult = await this.gateway.sendSocketMessage(instanceId, to, content);
          
          await this.prisma.whatsappMessage.update({
            where: { id: messageId },
            data: {
              status: 'SENT',
              deliveredAt: new Date(),
            },
          });
          this.logger.log(`[Whatsapp] Message Sent successfully: ${messageId}`);
          return sendResult;
        } catch (err) {
          this.logger.error(`[Whatsapp] Failed to send message: ${err.message}`);
          await this.prisma.whatsappMessage.update({
            where: { id: messageId },
            data: {
              status: 'FAILED',
              failedReason: err.message,
            },
          });
          throw err;
        }
      },
      {
        connection: redisOptions,
        limiter: {
          max: 1, // Prevent spamming / concurrent conflict
          duration: 1000,
        },
      }
    );

    this.worker.on('error', (err) => {
      this.isRedisAvailable = false;
      this.logger.warn(`[Whatsapp] BullMQ Worker Offline (Redis Unavailable): ${err.message}.`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`[Whatsapp] Job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close().catch(() => {});
    }
    if (this.queue) {
      await this.queue.close().catch(() => {});
    }
  }

  async enqueueMessage(instanceId: string, to: string, content: any, dbMessageId: string) {
    // Force set status to QUEUED first
    await this.prisma.whatsappMessage.update({
      where: { id: dbMessageId },
      data: { status: 'QUEUED' }
    });
    this.logger.log(`[Whatsapp] Message Queued: ${dbMessageId}`);

    if (!this.isRedisAvailable) {
      this.logger.log(`[Whatsapp] Redis offline. Sending WhatsApp message synchronously for message ID: ${dbMessageId}`);
      
      // Update to PROCESSING
      await this.prisma.whatsappMessage.update({
        where: { id: dbMessageId },
        data: { status: 'PROCESSING' }
      });

      try {
        await this.gateway.sendSocketMessage(instanceId, to, content);
        await this.prisma.whatsappMessage.update({
          where: { id: dbMessageId },
          data: {
            status: 'SENT',
            deliveredAt: new Date(),
          },
        });
        this.logger.log(`[Whatsapp] Message Sent (Sync Fallback): ${dbMessageId}`);
      } catch (err) {
        this.logger.error(`[Whatsapp] Synchronous send fallback failed: ${err.message}`);
        await this.prisma.whatsappMessage.update({
          where: { id: dbMessageId },
          data: {
            status: 'FAILED',
            failedReason: err.message,
          },
        });
      }
      return;
    }

    try {
      await this.queue.add(
        'send-msg',
        {
          messageId: dbMessageId,
          to,
          content,
          instanceId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    } catch (queueErr) {
      this.isRedisAvailable = false;
      this.logger.warn(`[Whatsapp] Queue insertion failed: ${queueErr.message}. Falling back to sync send.`);
      
      // Update to PROCESSING
      await this.prisma.whatsappMessage.update({
        where: { id: dbMessageId },
        data: { status: 'PROCESSING' }
      });

      // Sync retry
      try {
        await this.gateway.sendSocketMessage(instanceId, to, content);
        await this.prisma.whatsappMessage.update({
          where: { id: dbMessageId },
          data: {
            status: 'SENT',
            deliveredAt: new Date(),
          },
        });
        this.logger.log(`[Whatsapp] Message Sent (Sync Fallback): ${dbMessageId}`);
      } catch (syncErr) {
        await this.prisma.whatsappMessage.update({
          where: { id: dbMessageId },
          data: {
            status: 'FAILED',
            failedReason: syncErr.message,
          },
        });
      }
    }
  }

  // Resilient retry replay logic when connection opens
  async replayPendingQueue(instanceId: string): Promise<void> {
    this.logger.log(`[Whatsapp] Queue Restored. Replaying pending queue for instance: ${instanceId}`);
    
    const pendingMessages = await this.prisma.whatsappMessage.findMany({
      where: {
        instanceId,
        status: { in: ['QUEUED', 'FAILED', 'RETRYING'] }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (pendingMessages.length === 0) {
      this.logger.log(`[Whatsapp] No pending messages found in queue.`);
      return;
    }

    this.logger.log(`[Whatsapp] Found ${pendingMessages.length} pending messages. Replaying...`);
    
    for (const msg of pendingMessages) {
      // Find recipient phone
      let toPhone = '';
      if (msg.leadId) {
        const lead = await this.prisma.lead.findUnique({ where: { id: msg.leadId } });
        if (lead && lead.phone) {
          toPhone = lead.phone;
        }
      }

      if (!toPhone) {
        this.logger.warn(`[Whatsapp] Skipping message ${msg.id} because recipient lead phone is missing`);
        continue;
      }

      // Update state to RETRYING
      await this.prisma.whatsappMessage.update({
        where: { id: msg.id },
        data: { status: 'RETRYING' }
      });
      this.logger.log(`[Whatsapp] Retry message ID: ${msg.id}`);

      try {
        const content = msg.mediaUrl 
          ? (msg.mediaUrl.endsWith('.pdf') 
            ? { document: { url: msg.mediaUrl }, fileName: 'Document.pdf', mimetype: 'application/pdf', caption: msg.body }
            : { image: { url: msg.mediaUrl }, caption: msg.body })
          : { text: msg.body };

        await this.gateway.sendSocketMessage(instanceId, toPhone, content);

        await this.prisma.whatsappMessage.update({
          where: { id: msg.id },
          data: {
            status: 'SENT',
            deliveredAt: new Date()
          }
        });
        this.logger.log(`[Whatsapp] Message Sent successfully after retry: ${msg.id}`);
        // Delay to prevent rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err: any) {
        this.logger.error(`[Whatsapp] Retry failed for message ${msg.id}: ${err.message}`);
        await this.prisma.whatsappMessage.update({
          where: { id: msg.id },
          data: {
            status: 'FAILED',
            failedReason: err.message
          }
        });
      }
    }
  }
}
