import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, CommunicationChannel } from '@prisma/client';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/communication')
export class CommunicationController {
  constructor(
    private readonly communicationService: CommunicationService,
    private readonly emailService: EmailService
  ) {}

  @Get('templates')
  @Roles(UserRole.SUPER_ADMIN)
  async getAllTemplates() {
    return this.communicationService.getAllTemplates();
  }

  @Post('templates')
  @Roles(UserRole.SUPER_ADMIN)
  async createTemplate(
    @Body() body: { name: string; channel: CommunicationChannel; subject?: string; content: string; htmlContent?: string; isActive?: boolean }
  ) {
    return this.communicationService.createTemplate(body);
  }

  @Put('templates/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async updateTemplate(
    @Param('id') id: string,
    @Body() body: { name?: string; channel?: CommunicationChannel; subject?: string; content?: string; htmlContent?: string; isActive?: boolean }
  ) {
    return this.communicationService.updateTemplate(id, body);
  }

  @Delete('templates/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteTemplate(@Param('id') id: string) {
    return this.communicationService.deleteTemplate(id);
  }

  @Get('logs')
  async getLogs(@Query('leadId') leadId?: string) {
    return this.communicationService.getLogs(leadId);
  }

  @Get('logs/lead/:leadId')
  async getLogsByLead(@Param('leadId') leadId: string) {
    return this.communicationService.getLogs(leadId);
  }

  @Post('logs/:id/retry')
  async retryFailedEmail(@Param('id') id: string) {
    return this.communicationService.retryFailedEmail(id);
  }

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.communicationService.getDashboardStats();
  }

  @Post('enqueue')
  async enqueue(
    @Body() body: { leadId: string; channel: CommunicationChannel; eventType: string; payload?: any }
  ) {
    return this.communicationService.enqueue(body.leadId, body.channel, body.eventType, body.payload);
  }

  @Post('process')
  async processQueue() {
    await this.communicationService.processQueue();
    return { success: true, message: 'Queue processing triggered manually' };
  }

  // SMTP Settings Endpoints
  @Get('settings')
  @Roles(UserRole.SUPER_ADMIN)
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
    
    // Resolve password if masked is submitted but existing exists
    let passwordToTest = body.password;
    if (passwordToTest === '********') {
      const existing = await this.communicationService.getSettings(tenantId);
      if (existing) {
        const decryptedSettings = await this.prismaFindPassword(tenantId);
        passwordToTest = decryptedSettings;
      }
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

    // Resolve password if masked is submitted but existing exists
    let passwordToTest = body.password;
    if (passwordToTest === '********') {
      const existing = await this.communicationService.getSettings(tenantId);
      if (existing) {
        passwordToTest = await this.prismaFindPassword(tenantId);
      }
    }

    const testFromEmail = body.senderEmail || body.username;
    const testFromName = body.senderName || 'SMTP Test';

    // Send isolated test email bypassing queue/log
    await this.emailService.sendEmail(
      body.testRecipient,
      'Study Metro SMTP Test Email',
      'This is an isolated test email to verify your SMTP settings. No CommunicationQueue or CommunicationLog records were created.',
      '<h3>Study Metro SMTP Test Email</h3><p>This is an isolated test email to verify your SMTP settings. No CommunicationQueue or CommunicationLog records were created.</p>',
      tenantId
    );

    return { success: true, message: `Test email sent successfully to ${body.testRecipient}` };
  }

  private async prismaFindPassword(tenantId: string): Promise<string> {
    const { decrypt } = require('../../common/utils/crypto.util');
    const dbSettings = await this.communicationService.getSettings(tenantId);
    // Since getSettings masks the password, we query DB directly to get the ciphertext
    const raw = await this.communicationService['prisma'].emailSetting.findUnique({
      where: { tenantId }
    });
    return raw ? decrypt(raw.password) : '';
  }
}
