import { Controller, Get, Post, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { WhatsappService } from '../services/whatsapp.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../../../common/interfaces/request.interface';
import { PrismaService } from '../../../prisma/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly prisma: PrismaService
  ) {}

  @Post('connect')
  async connect(@Req() req: AuthenticatedRequest, @Body() body: { instanceName: string }) {
    console.log("POST /connect reached");
    const tenantId = req.tenantId || 'studymetro-global';
    return this.whatsappService.connect(tenantId, body.instanceName);
  }

  @Get('status/:id')
  async getStatus(@Param('id') id: string) {
    const status = await this.whatsappService.getStatus(id);
    return { status };
  }

  @Get('qr/:id')
  async getQR(@Param('id') id: string) {
    const details = await this.whatsappService.getQR(id);
    const gateway = this.whatsappService.getGatewayService();
    const qr = gateway.qrStore.get(id) || null;
    console.log("REST GET /qr/:id reached. Instance ID:", id, "Found in-memory QR:", !!qr);
    return { ...details, qr };
  }

  @Post('logout/:id')
  async logout(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.whatsappService.logout(id, tenantId);
  }

  @Get('instances')
  async getInstances(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.prisma.whatsappInstance.findMany({
      where: { tenantId },
    });
  }

  @Post('send')
  async send(
    @Req() req: AuthenticatedRequest,
    @Body() body: { leadId: string; message: string; mediaUrl?: string; fileName?: string }
  ) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.whatsappService.sendManualMessage(tenantId, body.leadId, body.message, body.mediaUrl, body.fileName);
  }

  @Get('history/:leadId')
  async getHistory(@Param('leadId') leadId: string) {
    return this.prisma.whatsappMessage.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Templates
  @Get('templates')
  async getTemplates(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.prisma.whatsappTemplate.findMany({
      where: { tenantId },
    });
  }

  @Post('templates')
  async createTemplate(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name: string; message: string; variables?: string[] }
  ) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.prisma.whatsappTemplate.create({
      data: {
        tenantId,
        name: body.name,
        body: body.message,
        message: body.message,
        category: 'Custom',
        isActive: true
      },
    });
  }

  // Automations
  @Get('automations')
  async getAutomations(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    const rules = await this.prisma.automationRule.findMany({
      where: { tenantId, channel: 'WHATSAPP' },
      include: { whatsappTemplate: true },
    });
    // Map to WhatsappAutomation format
    return rules.map(r => ({
      id: r.id,
      tenantId: r.tenantId,
      trigger: r.trigger,
      templateId: r.whatsappTemplateId,
      template: r.whatsappTemplate,
      enabled: r.enabled,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }

  @Post('automations')
  async saveAutomation(
    @Req() req: AuthenticatedRequest,
    @Body() body: { trigger: string; templateId: string; enabled: boolean }
  ) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.prisma.automationRule.create({
      data: {
        tenantId,
        name: `WhatsApp Automation Rule ${body.trigger}`,
        trigger: body.trigger,
        channel: 'WHATSAPP',
        whatsappTemplateId: body.templateId,
        enabled: body.enabled,
      },
    });
  }

  @Post('seed-defaults')
  async seedDefaults(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    const templatesToSeed = [
      {
        name: 'Welcome Template',
        message: 'Hello {{name}}, welcome to Study Metro! We received your registration. Your Lead Number is {{leadNumber}}.',
      },
      {
        name: 'Document Pending Template',
        message: 'Hello {{name}}, some documents are still pending for your application. Please upload them as soon as possible.',
      },
      {
        name: 'Followup Reminder Template',
        message: 'Hello {{name}}, this is a reminder for your upcoming counselling session scheduled for {{followupDate}}.',
      }
    ];

    const templateMap: Record<string, string> = {};

    for (const t of templatesToSeed) {
      let existing = await this.prisma.whatsappTemplate.findFirst({
        where: { tenantId, name: t.name }
      });
      if (!existing) {
        existing = await this.prisma.whatsappTemplate.create({
          data: {
            tenantId,
            name: t.name,
            body: t.message,
            message: t.message,
            category: 'Custom',
            isActive: true
          }
        });
      }
      templateMap[t.name] = existing.id;
    }

    const automationsToSeed = [
      { trigger: 'LEAD_CREATED', templateName: 'Welcome Template' },
      { trigger: 'DOCUMENT_PENDING', templateName: 'Document Pending Template' },
      { trigger: 'FOLLOWUP_REMINDER', templateName: 'Followup Reminder Template' }
    ];

    for (const auto of automationsToSeed) {
      const existingAuto = await this.prisma.automationRule.findFirst({
        where: { tenantId, trigger: auto.trigger, channel: 'WHATSAPP' }
      });
      if (!existingAuto) {
        await this.prisma.automationRule.create({
          data: {
            tenantId,
            name: `WhatsApp Automation Rule ${auto.trigger}`,
            trigger: auto.trigger,
            channel: 'WHATSAPP',
            whatsappTemplateId: templateMap[auto.templateName],
            enabled: true
          }
        });
      }
    }
    return { success: true };
  }
}
