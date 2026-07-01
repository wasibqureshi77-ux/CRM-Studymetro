import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsappQueueService } from '../queue/whatsapp.queue';
import { WhatsappGatewayService } from '../gateway/whatsapp.gateway';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: WhatsappQueueService,
    private readonly gateway: WhatsappGatewayService
  ) {}

  getGatewayService() {
    return this.gateway;
  }

  async connect(tenantId: string, instanceName: string) {
    let finalName = (instanceName || '').trim();
    if (!finalName) {
      const count = await this.prisma.whatsappInstance.count({
        where: { tenantId }
      });
      finalName = `WhatsApp Instance ${count + 1}`;
      let exists = await this.prisma.whatsappInstance.findFirst({
        where: { tenantId, instanceName: finalName }
      });
      let index = count + 1;
      while (exists) {
        index++;
        finalName = `WhatsApp Instance ${index}`;
        exists = await this.prisma.whatsappInstance.findFirst({
          where: { tenantId, instanceName: finalName }
        });
      }
    }

    console.log(`Creating WhatsApp instance with name: ${finalName}`);
    let instance = await this.prisma.whatsappInstance.findFirst({
      where: { tenantId, instanceName: finalName },
    });

    if (!instance) {
      instance = await this.prisma.whatsappInstance.create({
        data: {
          tenantId,
          instanceName: finalName,
          status: 'DISCONNECTED',
        },
      });
    }

    // Connect asynchronously
    this.gateway.connectInstance(instance.id, tenantId).catch((err) => {
      this.logger.error(`Error connecting instance ${instance.id}: ${err.message}`);
    });

    return instance;
  }

  async getStatus(id: string) {
    const inst = await this.prisma.whatsappInstance.findUnique({
      where: { id },
    });
    return inst ? inst.status : 'DISCONNECTED';
  }

  async getQR(id: string) {
    // Return connection/instance details
    return this.prisma.whatsappInstance.findUnique({
      where: { id },
      select: { id: true, status: true, phoneNumber: true, displayName: true },
    });
  }

  async logout(id: string, tenantId: string) {
    await this.gateway.logoutInstance(id, tenantId);
    return { success: true };
  }

  async sendTemplateMessage(tenantId: string, leadId: string, templateId: string, variablesMap: Record<string, string>) {
    console.log(`[Whatsapp] Outbound Template Message Send requested. Tenant: ${tenantId}, Lead: ${leadId}, Template ID: ${templateId}`);
    
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    const template = await this.prisma.whatsappTemplate.findUnique({ where: { id: templateId } });
    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { tenantId, status: 'CONNECTED' },
    });

    if (!lead || !template || !instance) {
      console.error(`[Whatsapp] Template Send Failure: lead exists: ${!!lead}, template exists: ${!!template}, connected instance exists: ${!!instance}`);
      throw new Error('Required Lead, Template or Connected Instance missing');
    }

    console.log(`[Whatsapp] Selected Instance ID: ${instance.id}, Destination Phone: ${lead.phone}`);
    let body = template.message;
    for (const key of Object.keys(variablesMap)) {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), variablesMap[key]);
    }

    const dbMsg = await this.prisma.whatsappMessage.create({
      data: {
        leadId,
        instanceId: instance.id,
        direction: 'OUTBOUND',
        messageType: 'TEXT',
        messageId: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        body,
        status: 'PENDING',
      },
    });
    console.log(`[Whatsapp] Template message persisted: ${dbMsg.id}, Body: "${body}"`);

    await this.queue.enqueueMessage(instance.id, lead.phone, { text: body }, dbMsg.id);
    return dbMsg;
  }

  async sendManualMessage(tenantId: string, leadId: string, body: string, mediaUrl?: string, fileName?: string) {
    console.log(`[Whatsapp] Outbox Dispatch Request - Tenant: ${tenantId}, Lead ID: ${leadId}`);
    
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    const instance = await this.prisma.whatsappInstance.findFirst({
      where: { tenantId, status: 'CONNECTED' },
    });

    if (!lead || !instance) {
      console.error(`[Whatsapp] Dispatch Failure: lead exists: ${!!lead}, connected instance exists: ${!!instance}`);
      throw new Error('No connected WhatsApp instance found for tenant.');
    }

    console.log(`[Whatsapp] Selected Instance ID: ${instance.id}, Destination Phone: ${lead.phone}`);
    const type = mediaUrl ? (mediaUrl.endsWith('.pdf') ? 'PDF' : 'IMAGE') : 'TEXT';
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const dbMsg = await this.prisma.whatsappMessage.create({
      data: {
        leadId,
        instanceId: instance.id,
        direction: 'OUTBOUND',
        messageType: type,
        messageId,
        body: body || (type === 'TEXT' ? '' : `Sent ${type}`),
        mediaUrl,
        status: 'PENDING',
      },
    });
    console.log(`[Whatsapp] Message persisted in DB: ${dbMsg.id}, Status: PENDING`);

    let sendContent: any = { text: body };
    if (mediaUrl) {
      if (type === 'PDF') {
        sendContent = { document: { url: mediaUrl }, fileName: fileName || 'Document.pdf', mimetype: 'application/pdf', caption: body };
      } else {
        sendContent = { image: { url: mediaUrl }, caption: body };
      }
    }

    await this.queue.enqueueMessage(instance.id, lead.phone, sendContent, dbMsg.id);
    return dbMsg;
  }

  // Automations trigger engine
  async triggerAutomation(tenantId: string, leadId: string, eventTrigger: string, context: Record<string, string>) {
    const auto = await this.prisma.automationRule.findFirst({
      where: { tenantId, trigger: eventTrigger, channel: 'WHATSAPP', enabled: true },
      include: { whatsappTemplate: true },
    });

    if (auto && auto.whatsappTemplateId) {
      await this.sendTemplateMessage(tenantId, leadId, auto.whatsappTemplateId, context);
    }
  }
}
