import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunicationChannel, QueueStatus } from '@prisma/client';
import { EmailService } from './email.service';
import { encrypt, decrypt } from '../../common/utils/crypto.util';
import * as crypto from 'crypto';

@Injectable()
export class CommunicationService implements OnModuleInit {
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) { }

  async onModuleInit() {
    console.log('📡 Communication Service initialized. Seeding templates...');
    await this.seedTemplates();

    // Start background processing interval (runs every 15 seconds)
    setInterval(() => {
      this.processQueue().catch((err) => {
        console.log('Error processing communication queue in interval:', err);
      });
    }, 15000);

    // Start communication automation retry loop (runs every 60 seconds)
    setInterval(() => {
      this.executeRetryEngineLoop().catch((err) => {
        console.error('[CommunicationAutomation] Error in retry engine loop:', err.message);
      });
    }, 60000);
  }

  async seedTemplates() {
    const defaultTemplates = [
      {
        name: 'WELCOME',
        channel: CommunicationChannel.EMAIL,
        subject: 'Welcome to Study Metro!',
        content: 'Dear {{name}},\n\nWelcome to Study Metro! We are thrilled to help you on your educational journey.\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Welcome to <strong>Study Metro</strong>! We are thrilled to help you on your educational journey.</p><p>Reference ID: <strong>{{leadNumber}}</strong></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'WELCOME',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, welcome to Study Metro! We are excited to guide you through your study abroad journey. Reference ID: {{leadNumber}}',
        htmlContent: null
      },
      {
        name: 'BROCHURE',
        channel: CommunicationChannel.EMAIL,
        subject: 'Your Study Metro Brochure',
        content: 'Dear {{name}},\n\nThank you for choosing Study Metro! Here is your brochure link: {{brochureLink}}\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Thank you for choosing <strong>Study Metro</strong>!</p><p>Here is your brochure link: <a href="{{brochureLink}}">View Brochure</a></p><p>Reference ID: <strong>{{leadNumber}}</strong></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'BROCHURE',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, thank you for choosing Study Metro! Here is your brochure link: {{brochureLink}}. Reference ID: {{leadNumber}}',
        htmlContent: null
      },
      {
        name: 'WELCOME_BROCHURE',
        channel: CommunicationChannel.EMAIL,
        subject: 'Welcome to StudyMetro – Your Free Information Brochure',
        content: 'Dear {{name}},\n\nThank you for contacting StudyMetro.\n\nWe are excited to help you with your educational journey.\n\nReference ID:\n{{leadNumber}}\n\nYou can view your brochure here:\n\n{{brochureLink}}\n\nOur counsellor will contact you shortly.\n\nBest Regards,\nStudyMetro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Thank you for contacting <strong>StudyMetro</strong>.</p><p>We are excited to help you with your educational journey.</p><p>Reference ID:<br/><strong>{{leadNumber}}</strong></p><p>You can view your brochure here:</p><p><a href="{{brochureLink}}">View Brochure</a></p><p>Our counsellor will contact you shortly.</p><br/><p>Best Regards,<br/>StudyMetro Team</p>'
      },
      {
        name: 'WELCOME_BROCHURE',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, welcome to StudyMetro! Thank you for contacting us. You can view your brochure here: {{brochureLink}}. Reference ID: {{leadNumber}}',
        htmlContent: null
      },
      {
        name: 'DOCUMENT_REQUEST',
        channel: CommunicationChannel.EMAIL,
        subject: 'Documents Required for Application',
        content: 'Dear {{name}},\n\nPlease upload the following documents to proceed with your application:\n{{documentList}}\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Please upload the following documents to proceed with your application:</p><pre>{{documentList}}</pre><p>Reference ID: <strong>{{leadNumber}}</strong></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'DOCUMENT_REQUEST',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, please upload the required documents to proceed: {{documentList}}. Reference ID: {{leadNumber}}',
        htmlContent: null
      },
      {
        name: 'FOLLOWUP_REMINDER',
        channel: CommunicationChannel.EMAIL,
        subject: 'Followup Reminder',
        content: 'Dear {{name}},\n\nThis is a friendly reminder that you have a scheduled followup on {{followupDate}} with counsellor {{counsellor}}.\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>This is a friendly reminder that you have a scheduled followup on <strong>{{followupDate}}</strong> with counsellor <strong>{{counsellor}}</strong>.</p><p>Reference ID: <strong>{{leadNumber}}</strong></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'FOLLOWUP_REMINDER',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, reminder of your followup on {{followupDate}} with counsellor {{counsellor}}. Reference ID: {{leadNumber}}',
        htmlContent: null
      },
      {
        name: 'APPLICATION_SUBMITTED',
        channel: CommunicationChannel.EMAIL,
        subject: 'Application Submitted Successfully',
        content: 'Dear {{name}},\n\nYour application for course {{course}} in {{country}} has been successfully submitted.\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Your application for course <strong>{{course}}</strong> in <strong>{{country}}</strong> has been successfully submitted.</p><p>Reference ID: <strong>{{leadNumber}}</strong></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'APPLICATION_SUBMITTED',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, your application for {{course}} in {{country}} has been submitted successfully. Reference ID: {{leadNumber}}',
        htmlContent: null
      },
      {
        name: 'OFFER_RECEIVED',
        channel: CommunicationChannel.EMAIL,
        subject: 'Offer Letter Received!',
        content: 'Dear {{name}},\n\nCongratulations! We have received an offer letter for your application to {{course}} in {{country}}.\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p><strong>Congratulations!</strong> We have received an offer letter for your application to <strong>{{course}}</strong> in <strong>{{country}}</strong>.</p><p>Reference ID: <strong>{{leadNumber}}</strong></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'OFFER_RECEIVED',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, congratulations! Offer letter received for {{course}} in {{country}}. Reference ID: {{leadNumber}}',
        htmlContent: null
      },
      {
        name: 'OFFER_ACCEPTED',
        channel: CommunicationChannel.EMAIL,
        subject: 'Offer Accepted',
        content: 'Dear {{name}},\n\nYou have accepted the offer for {{course}} in {{country}}. We will begin the visa process next.\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>You have accepted the offer for <strong>{{course}}</strong> in <strong>{{country}}</strong>. We will begin the visa process next.</p><p>Reference ID: <strong>{{leadNumber}}</strong></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'OFFER_ACCEPTED',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, offer accepted for {{course}} in {{country}}. We are starting your visa process. Reference ID: {{leadNumber}}',
        htmlContent: null
      },
      {
        name: 'VISA_APPLIED',
        channel: CommunicationChannel.EMAIL,
        subject: 'Visa Application Submitted',
        content: 'Dear {{name}},\n\nYour visa application for {{country}} has been submitted.\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Your visa application for <strong>{{country}}</strong> has been submitted.</p><p>Reference ID: <strong>{{leadNumber}}</strong></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'VISA_APPLIED',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, your visa application for {{country}} has been submitted. Reference ID: {{leadNumber}}',
        htmlContent: null
      },
      {
        name: 'VISA_APPROVED',
        channel: CommunicationChannel.EMAIL,
        subject: 'Visa Approved!',
        content: 'Dear {{name}},\n\nFantastic news! Your visa for {{country}} has been approved!\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p><strong>Fantastic news!</strong> Your visa for <strong>{{country}}</strong> has been approved!</p><p>Reference ID: <strong>{{leadNumber}}</strong></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'VISA_APPROVED',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, fantastic news! Your visa for {{country}} has been approved! 🎉 Reference ID: {{leadNumber}}',
        htmlContent: null
      },
      {
        name: 'ENROLLMENT_COMPLETE',
        channel: CommunicationChannel.EMAIL,
        subject: 'Enrollment Completed',
        content: 'Dear {{name}},\n\nYour enrollment process is now complete. Congratulations on starting your journey in {{country}}!\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team',
        htmlContent: '<h3>Dear {{name}},</h3><p>Your enrollment process is now complete. <strong>Congratulations</strong> on starting your journey in <strong>{{country}}</strong>!</p><p>Reference ID: <strong>{{leadNumber}}</strong></p><br/><p>Best regards,<br/>Study Metro Team</p>'
      },
      {
        name: 'ENROLLMENT_COMPLETE',
        channel: CommunicationChannel.WHATSAPP,
        subject: '',
        content: 'Hello {{name}}, your enrollment is complete! Congratulations on starting your journey in {{country}}! 🎓 Reference ID: {{leadNumber}}',
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
      } else {
        await this.prisma.communicationTemplate.update({
          where: { id: existing.id },
          data: {
            subject: t.subject,
            content: t.content,
            htmlContent: t.htmlContent,
          }
        });
      }
    }
    console.log('✅ Communication templates verified and seeded.');
  }

  async enqueue(leadId: string, channel: CommunicationChannel, eventType: string, payload: any, sourceService?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { tenantId: true }
    });

    let emailEnabled = true;
    let whatsappEnabled = false;

    if (lead) {
      const settings = await this.prisma.emailSetting.findUnique({
        where: { tenantId: lead.tenantId }
      });
      if (settings) {
        emailEnabled = settings.emailEnabled;
        whatsappEnabled = settings.whatsappEnabled;
      }
    }

    if (channel === CommunicationChannel.EMAIL && !emailEnabled) {
      console.log(`[QUEUE ENQUEUE SKIP] Email channel is disabled for Lead ID: ${leadId}`);
      return null;
    }

    if (channel === CommunicationChannel.WHATSAPP && !whatsappEnabled) {
      console.log(`[QUEUE ENQUEUE SKIP] WhatsApp channel is disabled for Lead ID: ${leadId}`);
      return null;
    }

    const queueItem = await this.prisma.communicationQueue.create({
      data: {
        leadId,
        channel,
        eventType,
        payload: payload || {},
        status: QueueStatus.PENDING,
      },
    });
    console.log(`[QUEUE ENQUEUE] Lead ID: ${leadId}, Event Type: ${eventType}, Source Service: ${sourceService || 'Unknown'}, Queue ID: ${queueItem.id}, Timestamp: ${new Date().toISOString()}`);
    return queueItem;
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      const pendingItems = await this.prisma.$transaction(async (tx) => {
        const lockedItems = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "CommunicationQueue"
          WHERE status = 'PENDING'
          ORDER BY "createdAt" ASC
          LIMIT 10
          FOR UPDATE SKIP LOCKED
        `;

        if (!lockedItems || lockedItems.length === 0) {
          return [];
        }

        const itemIds = lockedItems.map(item => item.id);

        await tx.communicationQueue.updateMany({
          where: { id: { in: itemIds } },
          data: { status: QueueStatus.PROCESSING }
        });

        return tx.communicationQueue.findMany({
          where: { id: { in: itemIds } }
        });
      });

      if (pendingItems.length === 0) {
        this.processing = false;
        return;
      }

      console.log(`Processing ${pendingItems.length} pending communication items...`);

      for (const item of pendingItems) {
        let textMessage = '';
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

          const appUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://crm.studymetrojaipur.com';
          const brochureLink = payload.brochureLink ? `${appUrl}/brochure/view/${payload.brochureLink}` : '';
          if (payload.brochureLink) {
            console.log(`[BROCHURE LINK GENERATION] Enqueued email contains brochure URL: ${brochureLink}`);
          }

          // Resolve plain content variables
          textMessage = template.content;
          textMessage = textMessage.replace(/\{\{name\}\}/g, name);
          textMessage = textMessage.replace(/\{\{leadId\}\}/g, lead.id);
          textMessage = textMessage.replace(/\{\{leadNumber\}\}/g, lead.leadNumber || lead.id);
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
            htmlMessage = htmlMessage.replace(/\{\{leadNumber\}\}/g, lead.leadNumber || lead.id);
            htmlMessage = htmlMessage.replace(/\{\{documentList\}\}/g, documentList.replace(/\n/g, '<br/>'));
            htmlMessage = htmlMessage.replace(/\{\{followupDate\}\}/g, followupDate);
            htmlMessage = htmlMessage.replace(/\{\{country\}\}/g, country);
            htmlMessage = htmlMessage.replace(/\{\{course\}\}/g, course);
            htmlMessage = htmlMessage.replace(/\{\{counsellor\}\}/g, counsellor);
            htmlMessage = htmlMessage.replace(/\{\{brochureLink\}\}/g, brochureLink);
          }

          // Generate student magic link if lead has studentPortalId
          if (lead.studentPortalId) {
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            
            await this.prisma.lead.update({
              where: { id: lead.id },
              data: {
                studentMagicToken: token,
                studentMagicExpiresAt: expiresAt,
              },
            });

            const studentPortalUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:3001';
            const callbackLink = `${studentPortalUrl}/login/callback?token=${token}`;
            
            textMessage += `\n\nOpen Student Portal: ${callbackLink}`;
            if (htmlMessage) {
              htmlMessage += `<p><a href="${callbackLink}" style="padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Open Student Portal</a></p><p>Or copy this URL: ${callbackLink}</p>`;
            }
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
              message: `Error: ${itemError.message}\n\nAttempted Message:\n${textMessage}`,
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
          emailEnabled: data.emailEnabled !== undefined ? data.emailEnabled : true,
          whatsappEnabled: data.whatsappEnabled !== undefined ? data.whatsappEnabled : false,
          studentPortalLoginEnabled: data.studentPortalLoginEnabled !== undefined ? data.studentPortalLoginEnabled : undefined,
          studentMagicLinkEnabled: data.studentMagicLinkEnabled !== undefined ? data.studentMagicLinkEnabled : undefined,
          studentEmailOtpEnabled: data.studentEmailOtpEnabled !== undefined ? data.studentEmailOtpEnabled : undefined,
          studentSmsOtpEnabled: data.studentSmsOtpEnabled !== undefined ? data.studentSmsOtpEnabled : undefined,
          studentWhatsappOtpEnabled: data.studentWhatsappOtpEnabled !== undefined ? data.studentWhatsappOtpEnabled : undefined,
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
          emailEnabled: data.emailEnabled !== undefined ? data.emailEnabled : true,
          whatsappEnabled: data.whatsappEnabled !== undefined ? data.whatsappEnabled : false,
          studentPortalLoginEnabled: data.studentPortalLoginEnabled !== undefined ? data.studentPortalLoginEnabled : true,
          studentMagicLinkEnabled: data.studentMagicLinkEnabled !== undefined ? data.studentMagicLinkEnabled : true,
          studentEmailOtpEnabled: data.studentEmailOtpEnabled !== undefined ? data.studentEmailOtpEnabled : true,
          studentSmsOtpEnabled: data.studentSmsOtpEnabled !== undefined ? data.studentSmsOtpEnabled : false,
          studentWhatsappOtpEnabled: data.studentWhatsappOtpEnabled !== undefined ? data.studentWhatsappOtpEnabled : false,
        }
      });
    }
  }

  // --- ENTERPRISE AUTOMATION SYSTEM ---

  async triggerEvent(triggerName: string, leadId: string, context: Record<string, string> = {}) {
    console.log(`[CommunicationAutomation] Triggering event: ${triggerName} for Lead ID: ${leadId}`);
    
    // Find active automations matching the trigger
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { studentProfile: true }
    });

    if (!lead) {
      console.warn(`[CommunicationAutomation] Lead ID ${leadId} not found. Skipping trigger.`);
      return;
    }

    const tenantId = lead.tenantId;

    const automations = await this.prisma.communicationAutomation.findMany({
      where: { tenantId, trigger: triggerName, enabled: true },
      include: { template: true }
    });

    if (automations.length === 0) {
      console.log(`[Whatsapp]\nMissing template: ${triggerName}`);
      return;
    }

    // Resolve appUrl dynamically
    const appUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://crm.studymetrojaipur.com';

    // Resolve Counsellor
    let counsellorName = 'Your Counsellor';
    if (lead.assigneeId) {
      const assignee = await this.prisma.user.findUnique({ where: { id: lead.assigneeId } });
      if (assignee) {
        counsellorName = `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim();
      }
    }

    // Resolve Brochure Title and Tracking link
    let brochureTitle = '';
    let brochureLink = '';
    const assignment: any = await this.prisma.brochureAssignment.findFirst({
      where: { leadId },
      include: { brochure: true },
      orderBy: { assignedAt: 'desc' }
    });
    if (assignment) {
      brochureTitle = assignment.brochure?.title || '';
      brochureLink = `${appUrl}/brochure/view/${assignment.token}`;
    }

    // Resolve Pending Documents List
    const pendingDocs = await this.prisma.leadDocument.findMany({
      where: { leadId, status: 'PENDING' }
    });
    const pendingDocuments = pendingDocs.length > 0 
      ? pendingDocs.map(d => `• ${d.documentType}`).join('\n') 
      : '• Passport\n• Marksheets\n• SOP\n• LOR';

    // Resolve Follow-up Date
    const latestFollowup = await this.prisma.followup.findFirst({
      where: { leadId, status: 'SCHEDULED' },
      orderBy: { followupDate: 'asc' }
    });
    const followupDate = latestFollowup ? new Date(latestFollowup.followupDate).toLocaleString() : 'Not scheduled';

    // Resolve Offer Letter details & Visa status
    const latestApp = await this.prisma.application.findFirst({
      where: { leadId },
      orderBy: { createdAt: 'desc' }
    });
    const visaStatus = latestApp?.visaStatus || 'NOT_STARTED';

    const offerDoc = await this.prisma.leadDocument.findFirst({
      where: { leadId, documentType: 'OFFER_LETTER' }
    });
    const offerLetterLink = offerDoc ? `${appUrl}/api/v1/leads/documents/download/${offerDoc.id}` : `${appUrl}/student/login`;
    const paymentLink = `${appUrl}/student/login?redirect=/payments`;

    for (const auto of automations) {
      // Prevent duplicates: Check if this exact automation was already triggered for this lead
      const existingLog = await this.prisma.communicationAutomationLog.findFirst({
        where: {
          automationId: auto.id,
          leadId,
          status: { in: ['SENT', 'QUEUED'] }
        }
      });
      if (existingLog) {
        console.log(`[CommunicationAutomation] Duplicate prevention: automation "${auto.name}" already dispatched/queued for lead ${leadId}. Skipping.`);
        continue;
      }

      // Evaluate conditions (Rule Builder)
      const isMatch = this.evaluateConditions(lead, auto.conditions);
      if (!isMatch) {
        console.log(`[CommunicationAutomation] Automation "${auto.name}" rule mismatch. Skipping.`);
        continue;
      }

      // Populate evaluated text body
      const variablesMap = {
        studentName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
        leadNumber: lead.leadNumber || '',
        course: lead.preferredCourse || lead.studentProfile?.targetCourse || '',
        country: lead.preferredCountry || lead.studentProfile?.targetCountry || '',
        intake: lead.intendedIntake || lead.studentProfile?.intake || '',
        assignedCounsellor: counsellorName,
        brochureTitle,
        brochureLink,
        portalLink: `${appUrl}/student/login`,
        pendingDocuments,
        followupDate,
        offerLetterLink,
        visaStatus,
        paymentLink,
        today: new Date().toLocaleDateString(),
        ...context
      };

      let evaluatedBody = auto.template.body;
      let evaluatedSubject = auto.template.subject || '';

      for (const [key, value] of Object.entries(variablesMap)) {
        evaluatedBody = evaluatedBody.replace(new RegExp(`{{${key}}}`, 'g'), value);
        evaluatedSubject = evaluatedSubject.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      if (auto.delayType === 'IMMEDIATE') {
        await this.executeAutomation(auto.id, leadId, auto.channels, evaluatedSubject, evaluatedBody, auto.maxRetries);
      } else {
        // Enqueue delayed / scheduled automation log
        for (const channel of auto.channels) {
          await this.prisma.communicationAutomationLog.create({
            data: {
              automationId: auto.id,
              leadId,
              channel,
              status: 'QUEUED',
              response: `Delayed trigger: ${auto.delayDuration || 'scheduled'}`,
            }
          });
        }
        console.log(`[CommunicationAutomation] Automation ${auto.name} enqueued with delay settings: ${auto.delayDuration}`);
      }
    }
  }

  private evaluateConditions(lead: any, conditions: any): boolean {
    if (!conditions) return true;
    try {
      const cond = typeof conditions === 'string' ? JSON.parse(conditions) : conditions;
      if (Object.keys(cond).length === 0) return true;
      for (const [key, val] of Object.entries(cond)) {
        const matchVal = String(val).toLowerCase().trim();
        if (key === 'country') {
          const leadCountry = String(lead.preferredCountry || lead.studentProfile?.targetCountry || '').toLowerCase().trim();
          if (leadCountry !== matchVal) return false;
        }
        if (key === 'course') {
          const leadCourse = String(lead.preferredCourse || lead.studentProfile?.targetCourse || '').toLowerCase().trim();
          if (!leadCourse.includes(matchVal)) return false;
        }
        if (key === 'status') {
          const leadStatus = String(lead.status || '').toLowerCase().trim();
          if (leadStatus !== matchVal) return false;
        }
      }
      return true;
    } catch {
      return true;
    }
  }

  private async executeAutomation(automationId: string, leadId: string, channels: string[], subject: string, body: string, maxRetries: number) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    for (const channel of channels) {
      const log = await this.prisma.communicationAutomationLog.create({
        data: {
          automationId,
          leadId,
          channel,
          status: 'PROCESSING',
          response: body
        }
      });

      try {
        if (channel === 'WHATSAPP') {
          // Resolve standard WhatsApp Gateway active socket
          const { WhatsappQueueService } = require('../whatsapp/queue/whatsapp.queue');
          const instance = await this.prisma.whatsappInstance.findFirst({
            where: { tenantId: lead.tenantId, status: 'CONNECTED' }
          });
          if (instance && WhatsappQueueService.instance) {
            // Build custom db message tracking row
            const dbMsg = await this.prisma.whatsappMessage.create({
              data: {
                leadId,
                instanceId: instance.id,
                direction: 'OUTBOUND',
                messageType: 'TEXT',
                messageId: `msg-auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                body,
                status: 'PENDING'
              }
            });
            await WhatsappQueueService.instance.enqueueMessage(instance.id, lead.phone, { text: body }, dbMsg.id);
            await this.prisma.communicationAutomationLog.update({
              where: { id: log.id },
              data: { status: 'SENT' }
            });
          } else {
            throw new Error('No connected WhatsApp gateway socket available.');
          }
        } else if (channel === 'EMAIL') {
          if (lead.email) {
            await this.emailService.sendEmail(lead.email, subject || 'Notification', body, `<p>${body.replace(/\n/g, '<br/>')}</p>`, lead.tenantId);
            await this.prisma.communicationAutomationLog.update({
              where: { id: log.id },
              data: { status: 'SENT' }
            });
          } else {
            throw new Error('Lead email address missing.');
          }
        } else if (channel === 'SMS') {
          console.log(`[SMS MOCK] Send: ${body} to ${lead.phone}`);
          await this.prisma.communicationAutomationLog.update({
            where: { id: log.id },
            data: { status: 'SENT' }
          });
        } else if (channel === 'PORTAL') {
          await this.prisma.studentNotification.create({
            data: {
              leadId,
              title: subject || 'New Notification',
              message: body
            }
          });
          await this.prisma.communicationAutomationLog.update({
            where: { id: log.id },
            data: { status: 'SENT', response: 'Portal notification created.' }
          });
        } else {
          // Push notification mock
          console.log(`[PUSH MOCK] Send: ${body}`);
          await this.prisma.communicationAutomationLog.update({
            where: { id: log.id },
            data: { status: 'SENT', response: 'Push notification executed.' }
          });
        }
      } catch (err: any) {
        console.error(`[CommunicationAutomation] Channel ${channel} execution failed:`, err.message);
        await this.prisma.communicationAutomationLog.update({
          where: { id: log.id },
          data: {
            status: 'FAILED',
            failedReason: err.message,
            retryCount: 0
          }
        });
      }
    }
  }

  // --- AUTOMATIONS CRUD ---

  async getAutomations(tenantId: string) {
    const autos = await this.prisma.communicationAutomation.findMany({
      where: { tenantId },
      include: { template: true, logs: true }
    });

    return autos.map(a => {
      const total = a.logs.length;
      const success = a.logs.filter(l => l.status === 'SENT').length;
      const failure = a.logs.filter(l => l.status === 'FAILED').length;
      const rate = total > 0 ? Math.round((success / total) * 100) : 100;
      const failRate = total > 0 ? Math.round((failure / total) * 100) : 0;
      const lastExecLog = a.logs.length > 0 ? a.logs[a.logs.length - 1] : null;

      return {
        id: a.id,
        name: a.name,
        trigger: a.trigger,
        channels: a.channels,
        enabled: a.enabled,
        delayType: a.delayType,
        delayDuration: a.delayDuration,
        cronExpression: a.cronExpression,
        conditions: a.conditions,
        maxRetries: a.maxRetries,
        templateId: a.templateId,
        templateName: a.template.name,
        successRate: rate,
        failureRate: failRate,
        totalExecutions: total,
        lastExecuted: lastExecLog ? lastExecLog.createdAt : null
      };
    });
  }

  async saveAutomation(tenantId: string, data: any) {
    return this.prisma.communicationAutomation.create({
      data: {
        tenantId,
        name: data.name,
        trigger: data.trigger,
        channels: data.channels,
        templateId: data.templateId,
        conditions: data.conditions || {},
        delayType: data.delayType || 'IMMEDIATE',
        delayDuration: data.delayDuration || null,
        cronExpression: data.cronExpression || null,
        maxRetries: Number(data.maxRetries || 3),
        enabled: data.enabled !== undefined ? data.enabled : true
      }
    });
  }

  async updateAutomation(id: string, data: any) {
    return this.prisma.communicationAutomation.update({
      where: { id },
      data: {
        name: data.name,
        trigger: data.trigger,
        channels: data.channels,
        templateId: data.templateId,
        conditions: data.conditions,
        delayType: data.delayType,
        delayDuration: data.delayDuration,
        cronExpression: data.cronExpression,
        maxRetries: data.maxRetries !== undefined ? Number(data.maxRetries) : undefined,
        enabled: data.enabled
      }
    });
  }

  async deleteAutomation(id: string) {
    return this.prisma.communicationAutomation.delete({ where: { id } });
  }

  async cloneAutomation(id: string) {
    const existing = await this.prisma.communicationAutomation.findUnique({ where: { id } });
    if (!existing) throw new Error('Automation rule not found');
    return this.prisma.communicationAutomation.create({
      data: {
        tenantId: existing.tenantId,
        name: `${existing.name} (Copy)`,
        trigger: existing.trigger,
        channels: existing.channels,
        templateId: existing.templateId,
        conditions: existing.conditions || {},
        delayType: existing.delayType,
        delayDuration: existing.delayDuration,
        cronExpression: existing.cronExpression,
        maxRetries: existing.maxRetries,
        enabled: false
      }
    });
  }

  // --- TEMPLATES CRUD & VERSIONING ---

  async getAutomationTemplates(tenantId: string) {
    return this.prisma.communicationAutomationTemplate.findMany({
      where: { tenantId },
      include: { versions: { orderBy: { version: 'desc' } } }
    });
  }

  async createAutomationTemplate(tenantId: string, data: any) {
    const t = await this.prisma.communicationAutomationTemplate.create({
      data: {
        tenantId,
        name: data.name,
        subject: data.subject || null,
        body: data.body,
        variables: data.variables || [],
        version: 1,
        isActive: true
      }
    });
    // Create initial version record
    await this.prisma.communicationAutomationTemplateVersion.create({
      data: {
        templateId: t.id,
        version: 1,
        subject: t.subject,
        body: t.body
      }
    });
    return t;
  }

  async updateAutomationTemplate(id: string, data: any) {
    const existing = await this.prisma.communicationAutomationTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('Template not found');

    const nextVer = existing.version + 1;
    const updated = await this.prisma.communicationAutomationTemplate.update({
      where: { id },
      data: {
        name: data.name,
        subject: data.subject,
        body: data.body,
        variables: data.variables || [],
        version: nextVer
      }
    });

    // Record template revision history
    await this.prisma.communicationAutomationTemplateVersion.create({
      data: {
        templateId: id,
        version: nextVer,
        subject: updated.subject,
        body: updated.body
      }
    });
    return updated;
  }

  async restoreTemplateVersion(id: string, versionId: string) {
    const ver = await this.prisma.communicationAutomationTemplateVersion.findUnique({ where: { id: versionId } });
    if (!ver || ver.templateId !== id) throw new Error('Selected template revision does not exist');
    const existing = await this.prisma.communicationAutomationTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('Template not found');

    const nextVer = existing.version + 1;
    return this.prisma.communicationAutomationTemplate.update({
      where: { id },
      data: {
        subject: ver.subject,
        body: ver.body,
        version: nextVer
      }
    });
  }

  // --- LOGS & ANALYTICS ---

  async getAutomationLogs(tenantId: string) {
    return this.prisma.communicationAutomationLog.findMany({
      where: { automation: { tenantId } },
      include: { automation: true, lead: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAutomationAnalytics(tenantId: string) {
    const logs = await this.prisma.communicationAutomationLog.findMany({
      where: { automation: { tenantId } },
      include: { lead: true }
    });

    const total = logs.length;
    const sent = logs.filter(l => l.status === 'SENT').length;
    const failed = logs.filter(l => l.status === 'FAILED').length;
    const pending = logs.filter(l => l.status === 'QUEUED' || l.status === 'PROCESSING').length;

    const rate = total > 0 ? Math.round((sent / total) * 100) : 100;
    const failRate = total > 0 ? Math.round((failed / total) * 100) : 0;

    // Aggregate by countries
    const countries: Record<string, number> = {};
    for (const l of logs) {
      const c = l.lead.preferredCountry || 'Unknown';
      countries[c] = (countries[c] || 0) + 1;
    }

    return {
      totalSent: sent,
      totalFailed: failed,
      totalPending: pending,
      successRate: rate,
      failureRate: failRate,
      topCountries: Object.entries(countries).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5)
    };
  }

  // Retry Engine Loop (runs every 1 minute)
  async executeRetryEngineLoop() {
    const failedLogs = await this.prisma.communicationAutomationLog.findMany({
      where: {
        status: 'FAILED',
        retryCount: { lt: 3 } // Limit to 3 retries max
      },
      include: { automation: true, lead: true }
    });

    for (const log of failedLogs) {
      const elapsedMinutes = (Date.now() - log.updatedAt.getTime()) / 60000;
      // Exponential backoff retry timer check (1m, 5m, 15m, 30m etc.)
      const requiredInterval = log.retryCount === 0 ? 1 : log.retryCount === 1 ? 5 : 30;
      if (elapsedMinutes >= requiredInterval) {
        console.log(`[CommunicationAutomation] Re-attempting failed message dispatch log ID: ${log.id}`);
        await this.prisma.communicationAutomationLog.update({
          where: { id: log.id },
          data: { status: 'PROCESSING', retryCount: log.retryCount + 1 }
        });

        try {
          if (log.channel === 'WHATSAPP') {
            const { WhatsappQueueService } = require('../whatsapp/queue/whatsapp.queue');
            const instance = await this.prisma.whatsappInstance.findFirst({
              where: { tenantId: log.automation.tenantId, status: 'CONNECTED' }
            });
            if (instance && WhatsappQueueService.instance) {
              const dbMsg = await this.prisma.whatsappMessage.create({
                data: {
                  leadId: log.leadId,
                  instanceId: instance.id,
                  direction: 'OUTBOUND',
                  messageType: 'TEXT',
                  messageId: `msg-retry-${Date.now()}`,
                  body: log.automation.name, // Fallback body reference
                  status: 'PENDING'
                }
              });
              await WhatsappQueueService.instance.enqueueMessage(instance.id, log.lead.phone, { text: log.automation.name }, dbMsg.id);
              await this.prisma.communicationAutomationLog.update({
                where: { id: log.id },
                data: { status: 'SENT', response: `Retried successfully. Msg ID: ${dbMsg.id}` }
              });
            } else {
              throw new Error('No active socket registry connection found during retry.');
            }
          } else if (log.channel === 'EMAIL') {
            if (log.lead.email) {
              await this.emailService.sendEmail(log.lead.email, log.automation.name, 'Retried notification text', '<p>Retried notification text</p>', log.automation.tenantId);
              await this.prisma.communicationAutomationLog.update({
                where: { id: log.id },
                data: { status: 'SENT', response: 'Retried successfully.' }
              });
            }
          }
        } catch (err: any) {
          await this.prisma.communicationAutomationLog.update({
            where: { id: log.id },
            data: { status: 'FAILED', failedReason: err.message }
          });
        }
      }
    }
  }
}
