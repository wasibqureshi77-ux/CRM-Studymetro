import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { decrypt } from '../../common/utils/crypto.util';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTransporter(tenantId: string) {
    // Fetch settings from DB
    const settings = await this.prisma.emailSetting.findUnique({
      where: { tenantId },
    });

    let host = process.env.SMTP_HOST;
    let port = parseInt(process.env.SMTP_PORT || '587', 10);
    let user = process.env.SMTP_USER;
    let pass = process.env.SMTP_PASS;
    let fromEmail = process.env.SMTP_FROM_EMAIL;
    let fromName = process.env.SMTP_FROM_NAME || 'Study Metro';
    let secure = port === 465;

    if (settings && settings.enabled) {
      host = settings.host;
      port = settings.port;
      user = settings.username;
      pass = decrypt(settings.password);
      fromEmail = settings.senderEmail;
      fromName = settings.senderName;
      secure = settings.encryption === 'SSL' || settings.port === 465;
    }

    if (!host || !user || !pass) {
      throw new Error('SMTP credentials are not configured.');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return { transporter, from: `"${fromName}" <${fromEmail || user}>` };
  }

  async sendEmail(to: string, subject: string, text: string, html?: string, tenantId?: string) {
    const resolvedTenantId = tenantId || 'studymetro-global';
    const { transporter, from } = await this.getTransporter(resolvedTenantId);

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    this.logger.log(`Email sent successfully: ${info.messageId}`);
    return info;
  }

  // Connection Test (direct verification, bypasses db storage)
  async testConnection(settings: any) {
    const secure = settings.encryption === 'SSL' || settings.port === 465;
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: Number(settings.port),
      secure,
      auth: {
        user: settings.username,
        pass: settings.password, // Raw password passed during test connection from UI
      },
    });

    await transporter.verify();
    return true;
  }

  // Health Check
  async healthCheck(tenantId: string) {
    try {
      const { transporter } = await this.getTransporter(tenantId);
      await transporter.verify();
      return { status: 'healthy', message: 'SMTP connection verified successfully' };
    } catch (err: any) {
      return { status: 'unhealthy', error: err.message };
    }
  }
}
