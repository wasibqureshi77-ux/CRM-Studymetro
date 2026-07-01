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
    @Body() body: { name: string; message: string; variables: string[] }
  ) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.prisma.whatsappTemplate.create({
      data: {
        tenantId,
        name: body.name,
        message: body.message,
        variables: body.variables,
      },
    });
  }

  // Automations
  @Get('automations')
  async getAutomations(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.prisma.whatsappAutomation.findMany({
      where: { tenantId },
      include: { template: true },
    });
  }

  @Post('automations')
  async saveAutomation(
    @Req() req: AuthenticatedRequest,
    @Body() body: { trigger: string; templateId: string; enabled: boolean }
  ) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.prisma.whatsappAutomation.create({
      data: {
        tenantId,
        trigger: body.trigger,
        templateId: body.templateId,
        enabled: body.enabled,
      },
    });
  }
}
