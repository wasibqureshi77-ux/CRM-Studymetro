import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunicationChannel, QueueStatus } from '@prisma/client';
import { EmailService } from './email.service';
import { encrypt, decrypt } from '../../common/utils/crypto.util';

@Injectable()
export class CommunicationService implements OnModuleInit {
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async onModuleInit() {
    console.log('📡 Communication Service initialized. Seeding templates...');
    await this.seedTemplates();

    // Start background processing interval (runs every 15 seconds)
    setInterval(() => {
      this.processQueue().catch((err) => {
        console.error('Error processing communication queue in interval:', err);
      });
    }, 15000);
  }

  async seedTemplates() {
    const defaultTemplates = [
      {
        name: 'WELCOME',
        channel: CommunicationChannel.EMAIL,
        subject: 'Welcome to Study Metro!',
        content: 'Dear {{name}},\n\nWelcome to Study Metro! We are thrilled to help you on your educational journey. Your lead ID is {{leadId}}.\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Welcome to <strong>Study Metro</strong>! We are thrilled to help you on your educational journey.</p><p>Your lead ID is <strong>{{leadId}}</strong>.</p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'WELCOME',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, welcome to Study Metro! We are excited to guide you through your study abroad journey. Lead ID: {{leadId}}.',
        htmlContent: null
      },
      {
        name: 'BROCHURE',
        channel: CommunicationChannel.EMAIL,
        subject: 'Your Study Metro Brochure',
        content: 'Dear {{name}},\n\nThank you for choosing Study Metro! Here is your brochure link: {{brochureLink}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Thank you for choosing <strong>Study Metro</strong>!</p><p>Here is your brochure link: <a href="{{brochureLink}}">View Brochure</a></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'BROCHURE',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, thank you for choosing Study Metro! Here is your brochure link: {{brochureLink}}',
        htmlContent: null
      },
      {
        name: 'DOCUMENT_REQUEST',
        channel: CommunicationChannel.EMAIL,
        subject: 'Documents Required for Application',
        content: 'Dear {{name}},\n\nPlease upload the following documents to proceed with your application:\n{{documentList}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Please upload the following documents to proceed with your application:</p><pre>{{documentList}}</pre><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'DOCUMENT_REQUEST',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, please upload the required documents to proceed: {{documentList}}.',
        htmlContent: null
      },
      {
        name: 'FOLLOWUP_REMINDER',
        channel: CommunicationChannel.EMAIL,
        subject: 'Followup Reminder',
        content: 'Dear {{name}},\n\nThis is a friendly reminder that you have a scheduled followup on {{followupDate}} with counsellor {{counsellor}}.\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>This is a friendly reminder that you have a scheduled followup on <strong>{{followupDate}}</strong> with counsellor <strong>{{counsellor}}</strong>.</p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'FOLLOWUP_REMINDER',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, reminder of your followup on {{followupDate}} with counsellor {{counsellor}}.',
        htmlContent: null
      },
      {
        name: 'APPLICATION_SUBMITTED',
        channel: CommunicationChannel.EMAIL,
        subject: 'Application Submitted Successfully',
        content: 'Dear {{name}},\n\nYour application for course {{course}} in {{country}} has been successfully submitted.\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Your application for course <strong>{{course}}</strong> in <strong>{{country}}</strong> has been successfully submitted.</p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'APPLICATION_SUBMITTED',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, your application for {{course}} in {{country}} has been submitted successfully.',
        htmlContent: null
      },
      {
        name: 'OFFER_RECEIVED',
        channel: CommunicationChannel.EMAIL,
        subject: 'Offer Letter Received!',
        content: 'Dear {{name}},\n\nCongratulations! We have received an offer letter for your application to {{course}} in {{country}}.\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p><strong>Congratulations!</strong> We have received an offer letter for your application to <strong>{{course}}</strong> in <strong>{{country}}</strong>.</p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'OFFER_RECEIVED',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, congratulations! Offer letter received for {{course}} in {{country}}.',
        htmlContent: null
      },
      {
        name: 'OFFER_ACCEPTED',
        channel: CommunicationChannel.EMAIL,
        subject: 'Offer Accepted',
        content: 'Dear {{name}},\n\nYou have accepted the offer for {{course}} in {{country}}. We will begin the visa process next.\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>You have accepted the offer for <strong>{{course}}</strong> in <strong>{{country}}</strong>. We will begin the visa process next.</p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'OFFER_ACCEPTED',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, offer accepted for {{course}} in {{country}}. We are starting your visa process.',
        htmlContent: null
      },
      {
        name: 'VISA_APPLIED',
        channel: CommunicationChannel.EMAIL,
        subject: 'Visa Application Submitted',
        content: 'Dear {{name}},\n\nYour visa application for {{country}} has been submitted.\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Your visa application for <strong>{{country}}</strong> has been submitted.</p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'VISA_APPLIED',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, your visa application for {{country}} has been submitted.',
        htmlContent: null
      },
      {
        name: 'VISA_APPROVED',
        channel: CommunicationChannel.EMAIL,
        subject: 'Visa Approved!',
        content: 'Dear {{name}},\n\nFantastic news! Your visa for {{country}} has been approved!\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p><strong>Fantastic news!</strong> Your visa for <strong>{{country}}</strong> has been approved!</p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'VISA_APPROVED',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, fantastic news! Your visa for {{country}} has been approved! 🎉',
        htmlContent: null
      },
      {
        name: 'ENROLLMENT_COMPLETE',
        channel: CommunicationChannel.EMAIL,
        subject: 'Enrollment Completed',
        content: 'Dear {{name}},\n\nYour enrollment process is now complete. Congratulations on starting your journey in {{country}}!\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Your enrollment process is now complete. <strong>Congratulations</strong> on starting your journey in <strong>{{country}}</strong>!</p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'ENROLLMENT_COMPLETE',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, your enrollment is complete! Congratulations on starting your journey in {{country}}! 🎓',
        htmlContent: null
      },
    ];

    for (const t of defaultTemplates) {
      const existing = await this.prisma.communicationTemplate.findFirst({
        where: { name: t.name, channel: t.channel },
      });

      if (!existing) {
        await this.prisma.communicationTemplate.create({
          data: {
            name: t.name,
            channel: t.channel,
            subject: t.subject,
            content: t.content,
            htmlContent: t.htmlContent,
            isActive: true,
          },
        });
      }
    }
    console.log('✅ Communication templates verified and seeded.');
  }

  async enqueue(leadId: string, channel: CommunicationChannel, eventType: string, payload: any) {
    console.log(`Enqueuing communication for lead ${leadId}, channel ${channel}, event ${eventType}`);
    return this.prisma.communicationQueue.create({
      data: {
        leadId,
        channel,
        eventType,
        payload: payload || {},
        status: QueueStatus.PENDING,
      },
    });
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      const pendingItems = await this.prisma.communicationQueue.findMany({
        where: { status: QueueStatus.PENDING },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });

      if (pendingItems.length === 0) {
        this.processing = false;
        return;
      }

      console.log(`Processing ${pendingItems.length} pending communication items...`);

      for (const item of pendingItems) {
        await this.prisma.communicationQueue.update({
          where: { id: item.id },
          data: { status: QueueStatus.PROCESSING },
        });

        try {
          const lead = await this.prisma.lead.findUnique({
            where: { id: item.leadId },
            include: {
              assignee: true,
              studentProfile: true,
            },
          });

          if (!lead) {
            throw new Error(`Lead with ID ${item.leadId} not found`);
          }

          const template = await this.prisma.communicationTemplate.findFirst({
            where: {
              name: item.eventType,
              channel: item.channel,
              isActive: true,
            },
          });

          if (!template) {
            throw new Error(`Active template not found for event ${item.eventType} and channel ${item.channel}`);
          }

          // Resolve variables
          let name = 'Student';
          if (lead.firstName || lead.lastName) {
            name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
          }

          const payload = (item.payload as any) || {};
          const documentList = payload.documentList || 'Passport, Marksheets, SOP, LOR';
          const followupDate = payload.followupDate || new Date().toLocaleDateString();
          const country = lead.studentProfile?.targetCountry || lead.preferredCountry || payload.country || 'selected destination';
          const course = lead.studentProfile?.targetCourse || lead.preferredCourse || payload.course || 'selected course';
          const counsellor = lead.assignee
            ? `${lead.assignee.firstName || ''} ${lead.assignee.lastName || ''}`.trim()
            : payload.counsellor || 'Assigned Counsellor';

          const brochureLink = payload.brochureLink ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/brochure/view/${payload.brochureLink}` : '';

          // Resolve plain content variables
          let textMessage = template.content;
          textMessage = textMessage.replace(/\{\{name\}\}/g, name);
          textMessage = textMessage.replace(/\{\{leadId\}\}/g, lead.id);
          textMessage = textMessage.replace(/\{\{documentList\}\}/g, documentList);
          textMessage = textMessage.replace(/\{\{followupDate\}\}/g, followupDate);
          textMessage = textMessage.replace(/\{\{country\}\}/g, country);
          textMessage = textMessage.replace(/\{\{course\}\}/g, course);
          textMessage = textMessage.replace(/\{\{counsellor\}\}/g, counsellor);
          textMessage = textMessage.replace(/\{\{brochureLink\}\}/g, brochureLink);

          // Resolve HTML content variables if email and htmlContent exists
          let htmlMessage = '';
          if (item.channel === CommunicationChannel.EMAIL && template.htmlContent) {
            htmlMessage = template.htmlContent;
            htmlMessage = htmlMessage.replace(/\{\{name\}\}/g, name);
            htmlMessage = htmlMessage.replace(/\{\{leadId\}\}/g, lead.id);
            htmlMessage = htmlMessage.replace(/\{\{documentList\}\}/g, documentList.replace(/\n/g, '<br/>'));
            htmlMessage = htmlMessage.replace(/\{\{followupDate\}\}/g, followupDate);
            htmlMessage = htmlMessage.replace(/\{\{country\}\}/g, country);
            htmlMessage = htmlMessage.replace(/\{\{course\}\}/g, course);
            htmlMessage = htmlMessage.replace(/\{\{counsellor\}\}/g, counsellor);
            htmlMessage = htmlMessage.replace(/\{\{brochureLink\}\}/g, brochureLink);
          }

          const recipient = item.channel === CommunicationChannel.EMAIL ? lead.email : lead.phone;
          if (!recipient) {
            throw new Error(`No contact destination found for lead on channel ${item.channel}`);
          }

          // Real email sending
          if (item.channel === CommunicationChannel.EMAIL) {
            const subject = template.subject || 'Study Metro Update';
            // Send using Nodemailer
            await this.emailService.sendEmail(
              recipient,
              subject,
              textMessage,
              htmlMessage || undefined,
              lead.tenantId
            );
          } else {
            // Mock WhatsApp (simply log to console)
            console.log(`[WHATSAPP MOCK] Sent message to ${recipient}: ${textMessage}`);
          }

          // Create sent log
          await this.prisma.communicationLog.create({
            data: {
              leadId: lead.id,
              channel: item.channel,
              eventType: item.eventType,
              status: QueueStatus.SENT,
              recipient,
              message: textMessage,
            },
          });

          // Mark queue item as SENT
          await this.prisma.communicationQueue.update({
            where: { id: item.id },
            data: {
              status: QueueStatus.SENT,
              processedAt: new Date(),
            },
          });

        } catch (itemError) {
          console.error(`Failed to process communication queue item ${item.id}:`, itemError.message);

          // Create failed log
          await this.prisma.communicationLog.create({
            data: {
              leadId: item.leadId,
              channel: item.channel,
              eventType: item.eventType,
              status: QueueStatus.FAILED,
              recipient: item.channel === CommunicationChannel.EMAIL ? 'Email address not resolved' : 'Phone number not resolved',
              message: `Error: ${itemError.message}`,
            },
          });

          await this.prisma.communicationQueue.update({
            where: { id: item.id },
            data: {
              status: QueueStatus.FAILED,
              processedAt: new Date(),
            },
          });
        }
      }
    } catch (err) {
      console.error('Error executing processQueue:', err);
    } finally {
      this.processing = false;
    }
  }

  // Manual retry mechanism for failed logs
  async retryFailedEmail(logId: string) {
    const log = await this.prisma.communicationLog.findUnique({
      where: { id: logId }
    });

    if (!log) {
      throw new Error('Log not found');
    }

    if (log.status !== QueueStatus.FAILED) {
      throw new Error('Can only retry failed communication logs');
    }

    // Enqueue a new queue entry
    const newQueueItem = await this.prisma.communicationQueue.create({
      data: {
        leadId: log.leadId,
        channel: log.channel,
        eventType: log.eventType,
        payload: {
          recipient: log.recipient
        },
        status: QueueStatus.PENDING
      }
    });

    // Manually trigger queue processing immediately
    this.processQueue().catch((err) => {
      console.error('Failed to run manual queue process:', err);
    });

    return newQueueItem;
  }

  async getLogs(leadId?: string) {
    if (leadId) {
      return this.prisma.communicationLog.findMany({
        where: { leadId },
        orderBy: { sentAt: 'desc' },
      });
    }
    return this.prisma.communicationLog.findMany({
      orderBy: { sentAt: 'desc' },
    });
  }

  async getDashboardStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const messagesSentToday = await this.prisma.communicationLog.count({
      where: {
        status: QueueStatus.SENT,
        sentAt: { gte: startOfToday },
      },
    });

    const pendingQueue = await this.prisma.communicationQueue.count({
      where: { status: QueueStatus.PENDING },
    });

    const failedMessages = await this.prisma.communicationLog.count({
      where: { status: QueueStatus.FAILED },
    });

    const upcomingFollowups = await this.prisma.followup.count({
      where: {
        status: 'SCHEDULED',
        followupDate: { gte: new Date() },
      },
    });

    return {
      messagesSentToday,
      pendingQueue,
      failedMessages,
      upcomingFollowups,
    };
  }

  // Template Manager CRUD
  async getAllTemplates() {
    return this.prisma.communicationTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createTemplate(data: { name: string; channel: CommunicationChannel; subject?: string; content: string; htmlContent?: string; isActive?: boolean }) {
    return this.prisma.communicationTemplate.create({
      data,
    });
  }

  async updateTemplate(id: string, data: { name?: string; channel?: CommunicationChannel; subject?: string; content?: string; htmlContent?: string; isActive?: boolean }) {
    return this.prisma.communicationTemplate.update({
      where: { id },
      data,
    });
  }

  async deleteTemplate(id: string) {
    return this.prisma.communicationTemplate.delete({
      where: { id },
    });
  }

  // SMTP Settings CRUD with password encryption and masking
  async getSettings(tenantId: string) {
    const settings = await this.prisma.emailSetting.findUnique({
      where: { tenantId }
    });

    if (!settings) {
      return null;
    }

    return {
      ...settings,
      password: '********' // Always mask the password in API response
    };
  }

  async saveSettings(tenantId: string, data: any) {
    const existing = await this.prisma.emailSetting.findUnique({
      where: { tenantId }
    });

    let finalPassword = data.password;

    if (finalPassword === '********' || !finalPassword) {
      if (existing) {
        finalPassword = existing.password; // Preserve existing encrypted password
      } else {
        throw new Error('Password is required for new SMTP configuration');
      }
    } else {
      finalPassword = encrypt(finalPassword); // Encrypt password symmetrically
    }

    if (existing) {
      return this.prisma.emailSetting.update({
        where: { tenantId },
        data: {
          host: data.host,
          port: Number(data.port),
          username: data.username,
          password: finalPassword,
          senderName: data.senderName,
          senderEmail: data.senderEmail,
          encryption: data.encryption,
          enabled: data.enabled !== undefined ? data.enabled : true,
        }
      });
    } else {
      return this.prisma.emailSetting.create({
        data: {
          tenantId,
          host: data.host,
          port: Number(data.port),
          username: data.username,
          password: finalPassword,
          senderName: data.senderName,
          senderEmail: data.senderEmail,
          encryption: data.encryption,
          enabled: data.enabled !== undefined ? data.enabled : true,
        }
      });
    }
  }
}
