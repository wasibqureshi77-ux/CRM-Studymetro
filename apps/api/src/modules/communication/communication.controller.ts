import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/communication')
export class CommunicationController {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly emailService: EmailService
  ) {}

  // --- EMAIL TEMPLATES CRUD ---

  @Get('templates/email')
  async getEmailTemplates(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.communicationService.getEmailTemplates(tenantId);
  }

  @Post('templates/email')
  @Roles(UserRole.SUPER_ADMIN)
  async createEmailTemplate(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.communicationService.createEmailTemplate(tenantId, body);
  }

  @Put('templates/email/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateEmailTemplate(@Param('id') id: string, @Body() body: any) {
    return this.communicationService.updateEmailTemplate(id, body);
  }

  @Delete('templates/email/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteEmailTemplate(@Param('id') id: string) {
    return this.communicationService.deleteEmailTemplate(id);
  }

  @Post('templates/email/:id/clone')
  @Roles(UserRole.SUPER_ADMIN)
  async cloneEmailTemplate(@Param('id') id: string) {
    return this.communicationService.cloneEmailTemplate(id);
  }

  @Post('templates/email/:id/versions/:versionId/restore')
  @Roles(UserRole.SUPER_ADMIN)
  async restoreEmailTemplateVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.communicationService.restoreEmailTemplateVersion(id, versionId);
  }

  // --- WHATSAPP TEMPLATES CRUD ---

  @Get('templates/whatsapp')
  async getWhatsappTemplates(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.communicationService.getWhatsappTemplates(tenantId);
  }

  @Post('templates/whatsapp')
  @Roles(UserRole.SUPER_ADMIN)
  async createWhatsappTemplate(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.communicationService.createWhatsappTemplate(tenantId, body);
  }

  @Put('templates/whatsapp/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateWhatsappTemplate(@Param('id') id: string, @Body() body: any) {
    return this.communicationService.updateWhatsappTemplate(id, body);
  }

  @Delete('templates/whatsapp/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteWhatsappTemplate(@Param('id') id: string) {
    return this.communicationService.deleteWhatsappTemplate(id);
  }

  @Post('templates/whatsapp/:id/clone')
  @Roles(UserRole.SUPER_ADMIN)
  async cloneWhatsappTemplate(@Param('id') id: string) {
    return this.communicationService.cloneWhatsappTemplate(id);
  }

  @Post('templates/whatsapp/:id/versions/:versionId/restore')
  @Roles(UserRole.SUPER_ADMIN)
  async restoreWhatsappTemplateVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.communicationService.restoreWhatsappTemplateVersion(id, versionId);
  }

  // --- SMS TEMPLATES CRUD ---

  @Get('templates/sms')
  async getSmsTemplates(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.communicationService.getSmsTemplates(tenantId);
  }

  @Post('templates/sms')
  @Roles(UserRole.SUPER_ADMIN)
  async createSmsTemplate(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.communicationService.createSmsTemplate(tenantId, body);
  }

  @Put('templates/sms/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateSmsTemplate(@Param('id') id: string, @Body() body: any) {
    return this.communicationService.updateSmsTemplate(id, body);
  }

  @Delete('templates/sms/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteSmsTemplate(@Param('id') id: string) {
    return this.communicationService.deleteSmsTemplate(id);
  }

  @Post('templates/sms/:id/clone')
  @Roles(UserRole.SUPER_ADMIN)
  async cloneSmsTemplate(@Param('id') id: string) {
    return this.communicationService.cloneSmsTemplate(id);
  }

  @Post('templates/sms/:id/versions/:versionId/restore')
  @Roles(UserRole.SUPER_ADMIN)
  async restoreSmsTemplateVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.communicationService.restoreSmsTemplateVersion(id, versionId);
  }

  // --- AUTOMATION RULES CRUD ---

  @Get('autos')
  async getAutomations(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.communicationService.getAutomations(tenantId);
  }

  @Post('autos')
  @Roles(UserRole.SUPER_ADMIN)
  async saveAutomation(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.communicationService.saveAutomation(tenantId, body);
  }

  @Patch('autos/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateAutomation(@Param('id') id: string, @Body() body: any) {
    return this.communicationService.updateAutomation(id, body);
  }

  @Delete('autos/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteAutomation(@Param('id') id: string) {
    return this.communicationService.deleteAutomation(id);
  }

  @Post('autos/:id/clone')
  @Roles(UserRole.SUPER_ADMIN)
  async cloneAutomation(@Param('id') id: string) {
    return this.communicationService.cloneAutomation(id);
  }

  // --- SMTP OUTBOUND SETTINGS ---

  @Get('settings')
  async getSettings(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.communicationService.getSettings(tenantId);
  }

  @Post('settings')
  @Roles(UserRole.SUPER_ADMIN)
  async saveSettings(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenantId = req.tenantId || 'studymetro-global';
    return this.communicationService.saveSettings(tenantId, body);
  }

  @Post('settings/test-connection')
  @Roles(UserRole.SUPER_ADMIN)
  async testConnection(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenantId = req.tenantId || 'studymetro-global';
    let passwordToTest = body.password;
    if (passwordToTest === '********') {
      const raw = await this.communicationService['prisma'].emailSetting.findUnique({
        where: { tenantId }
      });
      const { decrypt } = require('../../common/utils/crypto.util');
      passwordToTest = raw ? decrypt(raw.password) : '';
    }

    await this.emailService.testConnection({
      host: body.host,
      port: Number(body.port),
      username: body.username,
      password: passwordToTest,
      encryption: body.encryption
    });

    return { success: true, message: 'SMTP connection verified successfully' };
  }

  @Post('settings/test-email')
  @Roles(UserRole.SUPER_ADMIN)
  async sendTestEmail(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenantId = req.tenantId || 'studymetro-global';
    await this.emailService.sendEmail(
      body.testRecipient,
      'Study Metro SMTP Test Email',
      'This is an isolated test email to verify your SMTP settings.',
      '<h3>Study Metro SMTP Test Email</h3><p>This is an isolated test email to verify your SMTP settings.</p>',
      tenantId
    );
    return { success: true, message: `Test email sent successfully to ${body.testRecipient}` };
  }

  // --- TEST SEND WITHOUT LEAD ---

  @Post('test-send')
  @Roles(UserRole.SUPER_ADMIN)
  async testSend(@Req() req: AuthenticatedRequest, @Body() body: any) {
    const tenantId = req.tenantId || 'studymetro-global';
    const { channel, recipient, subject, message } = body;

    if (channel === 'EMAIL') {
      await this.emailService.sendEmail(
        recipient,
        subject || 'Test Email Dispatch',
        message,
        message.replace(/\n/g, '<br/>'),
        tenantId
      );
      return { success: true, message: `Test email dispatched to ${recipient}` };
    } else if (channel === 'WHATSAPP') {
      const { WhatsappQueueService } = require('../whatsapp/queue/whatsapp.queue');
      const instance = await this.communicationService['prisma'].whatsappInstance.findFirst({
        where: { tenantId, status: 'CONNECTED' }
      });
      if (instance && WhatsappQueueService.instance) {
        const dbMsg = await this.communicationService['prisma'].whatsappMessage.create({
          data: {
            leadId: '', // Direct test, no lead
            instanceId: instance.id,
            direction: 'OUTBOUND',
            messageType: 'TEXT',
            messageId: `msg-direct-test-${Date.now()}`,
            body: message,
            status: 'PENDING'
          }
        });
        await WhatsappQueueService.instance.enqueueMessage(instance.id, recipient, { text: message }, dbMsg.id);
        return { success: true, message: `Test WhatsApp enqueued to ${recipient}` };
      } else {
        throw new Error('No connected WhatsApp gateway socket available.');
      }
    }
    throw new Error('Unsupported channel for test send');
  }

  // --- LOGS & STATS ---

  @Get('logs')
  async getLogs(@Query('leadId') leadId?: string) {
    return this.communicationService.getLogs(leadId);
  }

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.communicationService.getDashboardStats();
  }

  @Post('trigger-manual')
  async triggerManual(
    @Body() body: { leadId: string; triggerName: string }
  ) {
    return this.communicationService.triggerEvent(body.triggerName, body.leadId, { bypassDuplicateCheck: true });
  }

  @Post('seed-defaults')
  async seedDefaults(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId || 'studymetro-global';
    await this.communicationService.seedTenantDefaults(tenantId);
    return { success: true };
  }
}
