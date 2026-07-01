import { Queue, Worker, Job } from 'bullmq';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { WhatsappGatewayService } from '../gateway/whatsapp.gateway';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WhatsappQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue;
  private worker: Worker;
  private readonly logger = new Logger(WhatsappQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: WhatsappGatewayService
  ) {}

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
      this.logger.warn(`BullMQ Queue Offline (Redis Unavailable): ${err.message}. Falling back to synchronous messaging.`);
    });

    // Configure BullMQ Worker to process outbox messages with retries & exponential backoff
    this.worker = new Worker(
      'whatsapp-outbox',
      async (job: Job) => {
        const { messageId, to, content, instanceId } = job.data;
        this.logger.log(`Processing outbound message job: ${job.id} for messageId: ${messageId}`);

        try {
          const sendResult = await this.gateway.sendSocketMessage(instanceId, to, content);
          
          await this.prisma.whatsappMessage.update({
            where: { id: messageId },
            data: {
              status: 'SENT',
              deliveredAt: new Date(),
            },
          });
          return sendResult;
        } catch (err) {
          this.logger.error(`Failed to send message: ${err.message}`);
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
      this.logger.warn(`BullMQ Worker Offline (Redis Unavailable): ${err.message}.`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Job ${job?.id} failed: ${err.message}`);
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
    if (!this.isRedisAvailable) {
      this.logger.log(`Redis offline. Sending WhatsApp message synchronously for message ID: ${dbMessageId}`);
      try {
        await this.gateway.sendSocketMessage(instanceId, to, content);
        await this.prisma.whatsappMessage.update({
          where: { id: dbMessageId },
          data: {
            status: 'SENT',
            deliveredAt: new Date(),
          },
        });
      } catch (err) {
        this.logger.error(`Synchronous send fallback failed: ${err.message}`);
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
      this.logger.warn(`Queue insertion failed: ${queueErr.message}. Falling back to sync send.`);
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
}
