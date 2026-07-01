import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueStatus } from '@prisma/client';
import { EmailService } from './email.service';
import * as crypto from 'crypto';

@Injectable()
export class CommunicationService implements OnModuleInit {
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) { }

  async onModuleInit() {
    console.log('📡 Enterprise Communication Service initialized. Seeding templates...');
    await this.seedTemplates();

    // Start background processing interval for outbox queue (runs every 15 seconds)
    setInterval(() => {
      this.processQueue().catch((err) => {
        console.log('Error processing communication queue in interval:', err);
      });
    }, 15000);

    // Start retry loop (runs every 60 seconds)
    setInterval(() => {
      this.executeRetryEngineLoop().catch((err) => {
        console.error('[CommunicationAutomation] Error in retry engine loop:', err.message);
      });
    }, 60000);
  }

  // --- SEEDING RULES & TEMPLATES ---

  async seedTemplates() {
    const tenants = await this.prisma.tenant.findMany();
    for (const tenant of tenants) {
      await this.seedTenantDefaults(tenant.id);
    }
  }

  async seedTenantDefaults(tenantId: string) {
    // 1. Seed Default Email Templates
    const defaultEmailTemplates = [
      {
        name: 'WELCOME',
        subject: 'Welcome to Study Metro!',
        category: 'Lead',
        body: 'Dear {{studentName}},\n\nWelcome to Study Metro!\n\nYour personalized Study Metro brochure:\n\n{{brochureLink}}\n\nReference ID: {{leadNumber}}\n\nRegards,\nStudy Metro Team'
      },
      {
        name: 'DOCUMENT_REQUEST',
        subject: 'Documents Required for Application',
        category: 'Documents',
        body: 'Dear {{studentName}},\n\nPlease upload the required documents to proceed with your application:\n{{pendingDocuments}}\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team'
      },
      {
        name: 'FOLLOWUP_REMINDER',
        subject: 'Followup Appointment Reminder',
        category: 'Follow-up',
        body: 'Dear {{studentName}},\n\nThis is a friendly reminder that you have a scheduled followup on {{followupDate}} with counsellor {{assignedCounsellor}}.\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team'
      },
      {
        name: 'VISA_APPROVED',
        subject: 'Visa Approved!',
        category: 'Visa',
        body: 'Dear {{studentName}},\n\nFantastic news! Your visa for {{country}} has been approved!\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team'
      },
      {
        name: 'OFFER_RECEIVED',
        subject: 'Offer Letter Received!',
        category: 'Admissions',
        body: 'Dear {{studentName}},\n\nCongratulations! We have received an offer letter for your application to {{course}} in {{country}}.\n\nReference ID: {{leadNumber}}\n\nBest regards,\nStudy Metro Team'
      }
    ];

    const emailTemplateMap: Record<string, string> = {};
    for (const t of defaultEmailTemplates) {
      let existing = await this.prisma.emailTemplate.findFirst({
        where: { tenantId, name: t.name }
      });
      if (!existing) {
        existing = await this.prisma.emailTemplate.create({
          data: {
            tenantId,
            name: t.name,
            subject: t.subject,
            category: t.category,
            body: t.body,
            isActive: true
          }
        });
      }
      emailTemplateMap[t.name] = existing.id;
    }

    // 2. Seed Default WhatsApp Templates
    const defaultWhatsappTemplates = [
      {
        name: 'WELCOME',
        category: 'Lead',
        body: 'Hello {{studentName}},\n\nWelcome to Study Metro!\n\nYour personalized Study Metro brochure:\n\n{{brochureLink}}\n\nReference ID: {{leadNumber}}\n\nRegards,\nStudy Metro Team'
      },
      {
        name: 'DOCUMENT_REQUEST',
        category: 'Documents',
        body: 'Hello {{studentName}}, please upload the required documents to proceed: {{pendingDocuments}}. Reference ID: {{leadNumber}}'
      },
      {
        name: 'FOLLOWUP_REMINDER',
        category: 'Follow-up',
        body: 'Hello {{studentName}}, reminder of your followup on {{followupDate}} with counsellor {{assignedCounsellor}}. Reference ID: {{leadNumber}}'
      },
      {
        name: 'VISA_APPROVED',
        category: 'Visa',
        body: 'Hello {{studentName}}, fantastic news! Your visa for {{country}} has been approved! 🎉 Reference ID: {{leadNumber}}'
      },
      {
        name: 'OFFER_RECEIVED',
        category: 'Admissions',
        body: 'Hello {{studentName}}, congratulations! Offer letter received for {{course}} in {{country}}. Reference ID: {{leadNumber}}'
      }
    ];

    const whatsappTemplateMap: Record<string, string> = {};
    for (const t of defaultWhatsappTemplates) {
      let existing = await this.prisma.whatsappTemplate.findFirst({
        where: { tenantId, name: t.name }
      });
      if (!existing) {
        existing = await this.prisma.whatsappTemplate.create({
          data: {
            tenantId,
            name: t.name,
            category: t.category,
            body: t.body,
            isActive: true
          }
        });
      }
      whatsappTemplateMap[t.name] = existing.id;
    }

    // 3. Seed default SMS Templates (Stubs)
    const smsTemplateMap: Record<string, string> = {};
    const defaultSmsTemplates = [
      { name: 'WELCOME', body: 'Welcome to Study Metro! Reference ID: {{leadNumber}}' }
    ];
    for (const t of defaultSmsTemplates) {
      let existing = await this.prisma.smsTemplate.findFirst({
        where: { tenantId, name: t.name }
      });
      if (!existing) {
        existing = await this.prisma.smsTemplate.create({
          data: {
            tenantId,
            name: t.name,
            category: 'Lead',
            body: t.body,
            isActive: true
          }
        });
      }
      smsTemplateMap[t.name] = existing.id;
    }

    // 4. Seed Idempotent Automation Rules linking triggers to Templates
    const defaultTriggers = [
      { name: 'Welcome Email Rule', trigger: 'LEAD_CREATED', channel: 'EMAIL', templateName: 'WELCOME' },
      { name: 'Welcome WhatsApp Rule', trigger: 'LEAD_CREATED', channel: 'WHATSAPP', templateName: 'WELCOME' },
      { name: 'Document Pending Email Rule', trigger: 'DOCUMENT_PENDING', channel: 'EMAIL', templateName: 'DOCUMENT_REQUEST' },
      { name: 'Document Pending WhatsApp Rule', trigger: 'DOCUMENT_PENDING', channel: 'WHATSAPP', templateName: 'DOCUMENT_REQUEST' },
      { name: 'Follow-up Reminder Email Rule', trigger: 'FOLLOWUP_REMINDER', channel: 'EMAIL', templateName: 'FOLLOWUP_REMINDER' },
      { name: 'Follow-up Reminder WhatsApp Rule', trigger: 'FOLLOWUP_REMINDER', channel: 'WHATSAPP', templateName: 'FOLLOWUP_REMINDER' },
      { name: 'Visa Approved Email Rule', trigger: 'VISA_APPROVED', channel: 'EMAIL', templateName: 'VISA_APPROVED' },
      { name: 'Visa Approved WhatsApp Rule', trigger: 'VISA_APPROVED', channel: 'WHATSAPP', templateName: 'VISA_APPROVED' },
      { name: 'Offer Letter Received Email Rule', trigger: 'OFFER_RECEIVED', channel: 'EMAIL', templateName: 'OFFER_RECEIVED' },
      { name: 'Offer Letter Received WhatsApp Rule', trigger: 'OFFER_RECEIVED', channel: 'WHATSAPP', templateName: 'OFFER_RECEIVED' }
    ];

    for (const r of defaultTriggers) {
      const existing = await this.prisma.automationRule.findFirst({
        where: { tenantId, trigger: r.trigger, channel: r.channel }
      });

      if (!existing) {
        const emailTemplateId = r.channel === 'EMAIL' ? emailTemplateMap[r.templateName] : null;
        const whatsappTemplateId = r.channel === 'WHATSAPP' ? whatsappTemplateMap[r.templateName] : null;

        await this.prisma.automationRule.create({
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
      }
    }
  }

  // --- EMAIL TEMPLATE CRUD ---

  async getEmailTemplates(tenantId: string) {
    return this.prisma.emailTemplate.findMany({
      where: { tenantId },
      include: { versions: { orderBy: { version: 'desc' } } },
      orderBy: { name: 'asc' }
    });
  }

  async createEmailTemplate(tenantId: string, data: any) {
    const t = await this.prisma.emailTemplate.create({
      data: {
        tenantId,
        name: data.name,
        subject: data.subject || '',
        category: data.category || 'Custom',
        body: data.body,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    await this.prisma.emailTemplateVersion.create({
      data: {
        templateId: t.id,
        version: 1,
        subject: t.subject,
        body: t.body
      }
    });
    return t;
  }

  async updateEmailTemplate(id: string, data: any) {
    const existing = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('Email template not found');

    const nextVer = existing.version + 1;
    const updated = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        name: data.name,
        subject: data.subject,
        category: data.category,
        body: data.body,
        isActive: data.isActive,
        version: nextVer
      }
    });

    await this.prisma.emailTemplateVersion.create({
      data: {
        templateId: id,
        version: nextVer,
        subject: updated.subject,
        body: updated.body
      }
    });
    return updated;
  }

  async deleteEmailTemplate(id: string) {
    return this.prisma.emailTemplate.delete({ where: { id } });
  }

  async cloneEmailTemplate(id: string) {
    const existing = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('Email template not found');

    return this.createEmailTemplate(existing.tenantId, {
      name: `${existing.name} (Copy)`,
      subject: existing.subject,
      category: existing.category,
      body: existing.body,
      isActive: existing.isActive
    });
  }

  async restoreEmailTemplateVersion(id: string, versionId: string) {
    const ver = await this.prisma.emailTemplateVersion.findUnique({ where: { id: versionId } });
    if (!ver || ver.templateId !== id) throw new Error('Selected revision does not exist');
    const existing = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('Email template not found');

    return this.updateEmailTemplate(id, {
      name: existing.name,
      subject: ver.subject,
      category: existing.category,
      body: ver.body,
      isActive: existing.isActive
    });
  }

  // --- WHATSAPP TEMPLATE CRUD ---

  async getWhatsappTemplates(tenantId: string) {
    return this.prisma.whatsappTemplate.findMany({
      where: { tenantId },
      include: { versions: { orderBy: { version: 'desc' } } },
      orderBy: { name: 'asc' }
    });
  }

  async createWhatsappTemplate(tenantId: string, data: any) {
    const t = await this.prisma.whatsappTemplate.create({
      data: {
        tenantId,
        name: data.name,
        category: data.category || 'Custom',
        body: data.body,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    await this.prisma.whatsappTemplateVersion.create({
      data: {
        templateId: t.id,
        version: 1,
        body: t.body
      }
    });
    return t;
  }

  async updateWhatsappTemplate(id: string, data: any) {
    const existing = await this.prisma.whatsappTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('WhatsApp template not found');

    const nextVer = existing.version + 1;
    const updated = await this.prisma.whatsappTemplate.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        body: data.body,
        isActive: data.isActive,
        version: nextVer
      }
    });

    await this.prisma.whatsappTemplateVersion.create({
      data: {
        templateId: id,
        version: nextVer,
        body: updated.body
      }
    });
    return updated;
  }

  async deleteWhatsappTemplate(id: string) {
    return this.prisma.whatsappTemplate.delete({ where: { id } });
  }

  async cloneWhatsappTemplate(id: string) {
    const existing = await this.prisma.whatsappTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('WhatsApp template not found');

    return this.createWhatsappTemplate(existing.tenantId, {
      name: `${existing.name} (Copy)`,
      category: existing.category,
      body: existing.body,
      isActive: existing.isActive
    });
  }

  async restoreWhatsappTemplateVersion(id: string, versionId: string) {
    const ver = await this.prisma.whatsappTemplateVersion.findUnique({ where: { id: versionId } });
    if (!ver || ver.templateId !== id) throw new Error('Selected revision does not exist');
    const existing = await this.prisma.whatsappTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('WhatsApp template not found');

    return this.updateWhatsappTemplate(id, {
      name: existing.name,
      category: existing.category,
      body: ver.body,
      isActive: existing.isActive
    });
  }

  // --- SMS TEMPLATE CRUD ---

  async getSmsTemplates(tenantId: string) {
    return this.prisma.smsTemplate.findMany({
      where: { tenantId },
      include: { versions: { orderBy: { version: 'desc' } } },
      orderBy: { name: 'asc' }
    });
  }

  async createSmsTemplate(tenantId: string, data: any) {
    const t = await this.prisma.smsTemplate.create({
      data: {
        tenantId,
        name: data.name,
        category: data.category || 'Custom',
        body: data.body,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    await this.prisma.smsTemplateVersion.create({
      data: {
        templateId: t.id,
        version: 1,
        body: t.body
      }
    });
    return t;
  }

  async updateSmsTemplate(id: string, data: any) {
    const existing = await this.prisma.smsTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('SMS template not found');

    const nextVer = existing.version + 1;
    const updated = await this.prisma.smsTemplate.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        body: data.body,
        isActive: data.isActive,
        version: nextVer
      }
    });

    await this.prisma.smsTemplateVersion.create({
      data: {
        templateId: id,
        version: nextVer,
        body: updated.body
      }
    });
    return updated;
  }

  async deleteSmsTemplate(id: string) {
    return this.prisma.smsTemplate.delete({ where: { id } });
  }

  async cloneSmsTemplate(id: string) {
    const existing = await this.prisma.smsTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('SMS template not found');

    return this.createSmsTemplate(existing.tenantId, {
      name: `${existing.name} (Copy)`,
      category: existing.category,
      body: existing.body,
      isActive: existing.isActive
    });
  }

  async restoreSmsTemplateVersion(id: string, versionId: string) {
    const ver = await this.prisma.smsTemplateVersion.findUnique({ where: { id: versionId } });
    if (!ver || ver.templateId !== id) throw new Error('Selected revision does not exist');
    const existing = await this.prisma.smsTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error('SMS template not found');

    return this.updateSmsTemplate(id, {
      name: existing.name,
      category: existing.category,
      body: ver.body,
      isActive: existing.isActive
    });
  }

  // --- AUTOMATION RULES CRUD ---

  async getAutomations(tenantId: string) {
    return this.prisma.automationRule.findMany({
      where: { tenantId },
      include: {
        emailTemplate: true,
        whatsappTemplate: true,
        smsTemplate: true
      },
      orderBy: { trigger: 'asc' }
    });
  }

  async saveAutomation(tenantId: string, data: any) {
    if (data.id) {
      return this.updateAutomation(data.id, data);
    }
    return this.prisma.automationRule.create({
      data: {
        tenantId,
        name: data.name,
        trigger: data.trigger,
        channel: data.channel,
        emailTemplateId: data.emailTemplateId || null,
        whatsappTemplateId: data.whatsappTemplateId || null,
        smsTemplateId: data.smsTemplateId || null,
        delayType: data.delayType || 'IMMEDIATE',
        delayDuration: data.delayDuration || null,
        conditions: data.conditions || null,
        enabled: data.enabled !== undefined ? data.enabled : true
      }
    });
  }

  async updateAutomation(id: string, data: any) {
    return this.prisma.automationRule.update({
      where: { id },
      data: {
        name: data.name,
        trigger: data.trigger,
        channel: data.channel,
        emailTemplateId: data.emailTemplateId !== undefined ? data.emailTemplateId : null,
        whatsappTemplateId: data.whatsappTemplateId !== undefined ? data.whatsappTemplateId : null,
        smsTemplateId: data.smsTemplateId !== undefined ? data.smsTemplateId : null,
        delayType: data.delayType,
        delayDuration: data.delayDuration,
        conditions: data.conditions,
        enabled: data.enabled
      }
    });
  }

  async deleteAutomation(id: string) {
    return this.prisma.automationRule.delete({ where: { id } });
  }

  async cloneAutomation(id: string) {
    const existing = await this.prisma.automationRule.findUnique({ where: { id } });
    if (!existing) throw new Error('Automation rule not found');

    return this.prisma.automationRule.create({
      data: {
        tenantId: existing.tenantId,
        name: `${existing.name} (Copy)`,
        trigger: existing.trigger,
        channel: existing.channel,
        emailTemplateId: existing.emailTemplateId,
        whatsappTemplateId: existing.whatsappTemplateId,
        smsTemplateId: existing.smsTemplateId,
        delayType: existing.delayType,
        delayDuration: existing.delayDuration,
        conditions: existing.conditions || null,
        enabled: existing.enabled
      }
    });
  }

  // --- OUTBOUND EMAIL SETTINGS ---

  async getSettings(tenantId: string) {
    const settings = await this.prisma.emailSetting.findUnique({
      where: { tenantId }
    });
    if (!settings) return null;
    return {
      ...settings,
      password: '********' // Mask password
    };
  }

  async saveSettings(tenantId: string, data: any) {
    const { encrypt } = require('../../common/utils/crypto.util');
    let finalPassword = data.password;

    if (finalPassword === '********') {
      const existing = await this.prisma.emailSetting.findUnique({ where: { tenantId } });
      if (existing) {
        finalPassword = existing.password; // Retain encrypted password
      } else {
        finalPassword = encrypt('');
      }
    } else {
      finalPassword = encrypt(finalPassword);
    }

    return this.prisma.emailSetting.upsert({
      where: { tenantId },
      create: {
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
      },
      update: {
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

  // --- DYNAMIC DISPATCH AUTOMATION ENGINE ---

  async triggerEvent(triggerName: string, leadId: string, context: Record<string, any> = {}) {
    console.log(`[CommunicationAutomation] Triggering event: ${triggerName} for Lead ID: ${leadId}`);

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { studentProfile: true }
    });

    if (!lead) {
      console.warn(`[CommunicationAutomation] Lead ID ${leadId} not found. Skipping trigger.`);
      return;
    }

    const tenantId = lead.tenantId;

    // Resolve channel config toggles
    const settings = await this.prisma.emailSetting.findUnique({
      where: { tenantId }
    });
    const emailEnabled = settings ? settings.emailEnabled : true;
    const whatsappEnabled = settings ? settings.whatsappEnabled : false;

    // Find matching active automation rules
    const rules = await this.prisma.automationRule.findMany({
      where: { tenantId, trigger: triggerName, enabled: true },
      include: {
        emailTemplate: true,
        whatsappTemplate: true,
        smsTemplate: true
      }
    });

    if (rules.length === 0) {
      console.log(`[CommunicationAutomation] No active AutomationRules found for trigger ${triggerName}`);
      return;
    }

    // Resolve dynamic variables
    const appUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://crm.studymetrojaipur.com';

    let counsellorName = 'Your Counsellor';
    if (lead.assigneeId) {
      const assignee = await this.prisma.user.findUnique({ where: { id: lead.assigneeId } });
      if (assignee) {
        counsellorName = `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim();
      }
    }

    let brochureTitle = '';
    let brochureLink = '';
    let assignment: any = null;

    if (triggerName === 'LEAD_CREATED') {
      const activeBrochure = await this.prisma.brochure.findFirst({
        where: { category: lead.leadCategory, isActive: true }
      });
      if (activeBrochure) {
        // Poll for up to 3 seconds (30 * 100ms) for the assignment to appear in DB
        for (let i = 0; i < 30; i++) {
          assignment = await this.prisma.brochureAssignment.findFirst({
            where: { leadId },
            include: { brochure: true },
            orderBy: { assignedAt: 'desc' }
          });
          if (assignment) break;
          await new Promise(r => setTimeout(r, 100));
        }
      }
    } else {
      assignment = await this.prisma.brochureAssignment.findFirst({
        where: { leadId },
        include: { brochure: true },
        orderBy: { assignedAt: 'desc' }
      });
    }

    if (!assignment) {
      // Create a default brochure assignment if none exists for the lead dynamically
      const brochure = await this.prisma.brochure.findFirst({
        where: { category: lead.leadCategory, isActive: true },
        orderBy: { createdAt: 'desc' }
      });
      if (brochure) {
        const crypto = require('crypto');
        const token = crypto.randomBytes(24).toString('hex');
        assignment = await this.prisma.brochureAssignment.create({
          data: {
            leadId: lead.id,
            brochureId: brochure.id,
            token,
            tracking: {
              create: {
                opened: false,
                readingTime: 0,
                pageViews: 0,
                completionPercentage: 0,
                lastPageViewed: 0,
                downloadCount: 0,
                viewedPages: '',
                engagementScore: 0,
              },
            },
          },
          include: { brochure: true }
        });
      }
    }

    if (assignment) {
      brochureTitle = assignment.brochure?.title || '';
      brochureLink = `${appUrl}/brochure/view/${assignment.token}`;
    } else {
      brochureLink = `${appUrl}/student/login`;
    }

    const pendingDocs = await this.prisma.leadDocument.findMany({
      where: { leadId, status: 'PENDING' }
    });
    const pendingDocuments = pendingDocs.length > 0 
      ? pendingDocs.map(d => `• ${d.documentType}`).join('\n') 
      : '• Passport\n• Marksheets\n• SOP\n• LOR';

    const latestFollowup = await this.prisma.followup.findFirst({
      where: { leadId, status: 'SCHEDULED' },
      orderBy: { followupDate: 'asc' }
    });
    const followupDate = latestFollowup ? new Date(latestFollowup.followupDate).toLocaleString() : 'Not scheduled';

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

    const variablesMap = {
      studentName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
      name: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
      leadNumber: lead.leadNumber || '',
      leadId: lead.id,
      course: lead.preferredCourse || lead.studentProfile?.targetCourse || '',
      country: lead.preferredCountry || lead.studentProfile?.targetCountry || '',
      intake: lead.intendedIntake || lead.studentProfile?.intake || '',
      assignedCounsellor: counsellorName,
      counsellor: counsellorName,
      brochureTitle,
      brochureLink,
      portalLink: `${appUrl}/student/login`,
      pendingDocuments,
      documentList: pendingDocuments,
      followupDate,
      offerLetter: offerLetterLink,
      visaStatus,
      paymentLink,
      today: new Date().toLocaleDateString(),
      ...context
    };

    for (const rule of rules) {
      const channel = rule.channel;

      // Channel config checks
      if (channel === 'EMAIL' && !emailEnabled) {
        console.log(`[CommunicationAutomation] Email channel is disabled. Skipping rule ${rule.name}`);
        continue;
      }
      if (channel === 'WHATSAPP' && !whatsappEnabled) {
        console.log(`[CommunicationAutomation] WhatsApp channel is disabled. Skipping rule ${rule.name}`);
        continue;
      }

      // Check conditions if configured (e.g. filter by country)
      if (rule.conditions) {
        try {
          const filter = rule.conditions as Record<string, any>;
          let matched = true;
          for (const [k, val] of Object.entries(filter)) {
            if (lead[k] !== undefined && lead[k] !== val) {
              matched = false;
              break;
            }
          }
          if (!matched) {
            console.log(`[CommunicationAutomation] Conditions mismatch for rule ${rule.name}. Skipping.`);
            continue;
          }
        } catch (e) {
          console.error('[CommunicationAutomation] Error evaluating rule conditions:', e);
        }
      }

      // Resolve specific template contents
      let bodyText = '';
      let subjectText = '';
      let hasTemplate = false;

      if (channel === 'EMAIL' && rule.emailTemplate) {
        bodyText = rule.emailTemplate.body;
        subjectText = rule.emailTemplate.subject || '';
        hasTemplate = true;
      } else if (channel === 'WHATSAPP' && rule.whatsappTemplate) {
        bodyText = rule.whatsappTemplate.body;
        hasTemplate = true;
      } else if (channel === 'SMS' && rule.smsTemplate) {
        bodyText = rule.smsTemplate.body;
        hasTemplate = true;
      }

      if (!hasTemplate) {
        console.log(`[${channel}] Missing template: ${triggerName}`);
        continue;
      }

      // Evaluate placeholders
      let evaluatedBody = bodyText;
      let evaluatedSubject = subjectText;

      for (const [key, value] of Object.entries(variablesMap)) {
        const placeholderRegex = new RegExp(`{{${key}}}`, 'g');
        evaluatedBody = evaluatedBody.replace(placeholderRegex, String(value || ''));
        evaluatedSubject = evaluatedSubject.replace(placeholderRegex, String(value || ''));
      }

      // Warning verification logging
      if (bodyText.includes('{{brochureLink}}') && (!variablesMap.brochureLink || !variablesMap.brochureLink.trim() || variablesMap.brochureLink.includes('undefined'))) {
        console.error(`[CommunicationAutomation] ERROR: Template contains {{brochureLink}} but the variable is missing or empty!`);
      }

      // Prevent duplicate sends for status transitions on same lead (unless manually bypassed)
      const bypassDuplicateCheck = context?.bypassDuplicateCheck || false;
      if (triggerName !== 'LEAD_CREATED' && !bypassDuplicateCheck) {
        const existingLog = await this.prisma.communicationLog.findFirst({
          where: {
            leadId,
            automationId: rule.id,
            status: 'SENT'
          }
        });
        if (existingLog) {
          console.log(`[CommunicationAutomation] Duplicate prevention: rule "${rule.name}" already dispatched for lead ${leadId}. Skipping.`);
          continue;
        }
      }

      // Send output
      try {
        if (channel === 'EMAIL') {
          const recipient = lead.email;
          if (recipient) {
            await this.emailService.sendEmail(
              recipient,
              evaluatedSubject || 'Study Metro Update',
              evaluatedBody,
              evaluatedBody.replace(/\n/g, '<br/>'),
              lead.tenantId
            );

            await this.prisma.communicationLog.create({
              data: {
                tenantId,
                leadId: lead.id,
                automationId: rule.id,
                channel: 'EMAIL',
                eventType: triggerName,
                status: 'SENT',
                recipient,
                message: evaluatedBody
              }
            });
            console.log(`[CommunicationAutomation] Email sent successfully for rule ${rule.name}`);
          }
        } else if (channel === 'WHATSAPP') {
          const recipient = lead.phone;
          if (recipient) {
            console.log(`[WHATSAPP AUDIT] Final Rendered Message for WhatsApp:\n"""\n${evaluatedBody}\n"""`);

            const { WhatsappQueueService } = require('../whatsapp/queue/whatsapp.queue');
            const instance = await this.prisma.whatsappInstance.findFirst({
              where: { tenantId: lead.tenantId, status: 'CONNECTED' }
            });

            if (instance && WhatsappQueueService.instance) {
              const dbMsg = await this.prisma.whatsappMessage.create({
                data: {
                  leadId: lead.id,
                  instanceId: instance.id,
                  direction: 'OUTBOUND',
                  messageType: 'TEXT',
                  messageId: `msg-auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  body: evaluatedBody,
                  status: 'PENDING'
                }
              });

              await WhatsappQueueService.instance.enqueueMessage(instance.id, recipient, { text: evaluatedBody }, dbMsg.id);

              await this.prisma.communicationLog.create({
                data: {
                  tenantId,
                  leadId: lead.id,
                  automationId: rule.id,
                  channel: 'WHATSAPP',
                  eventType: triggerName,
                  status: 'SENT',
                  recipient,
                  message: evaluatedBody
                }
              });
              console.log(`[CommunicationAutomation] WhatsApp message enqueued successfully for rule ${rule.name}`);
            } else {
              console.warn('[CommunicationAutomation] No connected WhatsApp instance available or WhatsappQueueService is offline.');
            }
          }
        }
      } catch (err: any) {
        console.error(`[CommunicationAutomation] Fail dispatching rule ${rule.name}:`, err.message);
        await this.prisma.communicationLog.create({
          data: {
            tenantId,
            leadId: lead.id,
            automationId: rule.id,
            channel,
            eventType: triggerName,
            status: 'FAILED',
            recipient: channel === 'EMAIL' ? lead.email || '' : lead.phone || '',
            message: evaluatedBody,
            failedReason: err.message
          }
        });
      }
    }
  }

  // --- LOGS & AUDIT ---

  async getLogs(leadId?: string) {
    return this.prisma.communicationLog.findMany({
      where: leadId ? { leadId } : {},
      include: { automation: true, lead: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getDashboardStats() {
    const logs = await this.prisma.communicationLog.findMany();
    const total = logs.length;
    const sent = logs.filter(l => l.status === 'SENT').length;
    const failed = logs.filter(l => l.status === 'FAILED').length;
    return {
      totalLogs: total,
      successRate: total > 0 ? Math.round((sent / total) * 100) : 100,
      failRate: total > 0 ? Math.round((failed / total) * 100) : 0
    };
  }  async getPortalSettings(tenantId: string) {
    let settings = await this.prisma.portalSetting.findUnique({
      where: { tenantId }
    });
    if (!settings) {
      settings = await this.prisma.portalSetting.create({
        data: {
          tenantId,
          portalName: 'Student Portal',
          primaryColor: '#3b82f6',
          secondaryColor: '#1d4ed8',
          socialLinks: {}
        }
      });
    }
    return settings;
  }

  async savePortalSettings(tenantId: string, data: any) {
    return this.prisma.portalSetting.upsert({
      where: { tenantId },
      update: {
        portalName: data.portalName,
        logo: data.logo,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        supportEmail: data.supportEmail,
        supportPhone: data.supportPhone,
        privacyPolicy: data.privacyPolicy,
        termsConditions: data.termsConditions,
        footerText: data.footerText,
        socialLinks: data.socialLinks || {}
      },
      create: {
        tenantId,
        portalName: data.portalName,
        logo: data.logo,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        supportEmail: data.supportEmail,
        supportPhone: data.supportPhone,
        privacyPolicy: data.privacyPolicy,
        termsConditions: data.termsConditions,
        footerText: data.footerText,
        socialLinks: data.socialLinks || {}
      }
    });
  }

  // --- COMPATIBILITY STUBS & RETRY LOOPS ---

  async enqueue(leadId: string, channel: any, eventType: string, payload: any, sourceService?: string) {
    // Backwards compatibility placeholder
    return this.prisma.communicationQueue.create({
      data: {
        leadId,
        channel,
        eventType,
        payload: payload || {},
        status: QueueStatus.PENDING
      }
    });
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = false; // Stubbed outbox runner
  }

  async executeRetryEngineLoop() {
    // Stubbed outbox auto-retry runner
  }
}
