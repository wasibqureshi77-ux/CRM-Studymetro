import { Controller, Post, Get, Body, Req, Res, UseGuards, UnauthorizedException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response, Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../communication/email.service';
import { StudentJwtAuthGuard } from './guards/student-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import * as crypto from 'crypto';

export interface ISmsOtpSender {
  sendSmsOtp(phone: string, otp: string): Promise<boolean>;
}

export interface IWhatsAppOtpSender {
  sendWhatsAppOtp(phone: string, otp: string): Promise<boolean>;
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 10, windowMs = 60 * 1000) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

function parseUserAgent(userAgent: string): { browser: string; os: string; device: string } {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown', device: 'Desktop' };
  
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';

  const ua = userAgent.toLowerCase();

  // Device
  if (/mobile|android|iphone|ipad|phone/.test(ua)) {
    device = 'Mobile';
    if (/ipad|tablet/.test(ua)) {
      device = 'Tablet';
    }
  } else {
    device = 'Desktop';
  }

  // OS
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';

  // Browser
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

  return { browser, os, device };
}

@Controller('api/v1/student-portal/auth')
export class StudentAuthController implements ISmsOtpSender, IWhatsAppOtpSender {
  private readonly logger = new Logger(StudentAuthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  // Architectural interfaces for SMS and WhatsApp OTPs
  async sendSmsOtp(phone: string, otp: string): Promise<boolean> {
    this.logger.log(`[SMS OTP ARCHITECTURE] Sending OTP ${otp} to phone ${phone}`);
    return true;
  }

  async sendWhatsAppOtp(phone: string, otp: string): Promise<boolean> {
    this.logger.log(`[WhatsApp OTP ARCHITECTURE] Sending OTP ${otp} to phone ${phone}`);
    return true;
  }

  private async generateNextStudentPortalId(): Promise<string> {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const prefix = `STD${currentYear}`;

    const lastLead = await this.prisma.lead.findFirst({
      where: {
        studentPortalId: {
          startsWith: prefix,
        },
      },
      orderBy: {
        studentPortalId: 'desc',
      },
    });

    if (lastLead && lastLead.studentPortalId) {
      const lastNumStr = lastLead.studentPortalId.replace(prefix, '');
      const lastNum = parseInt(lastNumStr, 10);
      const nextNum = lastNum + 1;
      return `${prefix}${nextNum.toString().padStart(4, '0')}`;
    }

    return `${prefix}0001`;
  }

  @Post('check-email')
  async checkEmail(@Req() req: Request, @Body() body: { email: string }) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    if (!checkRateLimit(`check-email:${ip}`)) {
      throw new BadRequestException('Too many requests. Please try again later.');
    }

    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] as string || 'studymetro-global';
    if (!body.email) {
      throw new BadRequestException('Email address is required');
    }

    const emailTrimmed = body.email.trim();

    // First find if any lead exists with this email at all
    const anyLead = await this.prisma.lead.findFirst({
      where: {
        email: { equals: emailTrimmed, mode: 'insensitive' },
        tenantId,
        deletedAt: null,
      },
    });

    if (!anyLead) {
      throw new NotFoundException('Email not registered');
    }

    if (!anyLead.studentPortalId) {
      const newPortalId = await this.generateNextStudentPortalId();
      await this.prisma.lead.update({
        where: { id: anyLead.id },
        data: { studentPortalId: newPortalId },
      });
      anyLead.studentPortalId = newPortalId;
    }

    // Fetch enabled methods
    const settings = await this.prisma.emailSetting.findUnique({
      where: { tenantId },
    });

    if (settings && settings.studentPortalLoginEnabled === false) {
      throw new BadRequestException('Login disabled');
    }

    const methods = {
      magicLink: settings ? !!settings.studentMagicLinkEnabled : true,
      emailOtp: settings ? !!settings.studentEmailOtpEnabled : true,
      smsOtp: settings ? !!settings.studentSmsOtpEnabled : false,
      whatsappOtp: settings ? !!settings.studentWhatsappOtpEnabled : false,
    };

    return {
      exists: true,
      methods,
    };
  }

  @Post('send-otp')
  async sendOtp(@Req() req: Request, @Body() body: { email: string; method: string }) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    if (!checkRateLimit(`send-otp:${ip}`)) {
      throw new BadRequestException('Too many requests. Please try again later.');
    }

    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] as string || 'studymetro-global';
    if (!body.email || !body.method) {
      throw new BadRequestException('Email and method are required');
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        email: { equals: body.email.trim(), mode: 'insensitive' },
        tenantId,
        deletedAt: null,
      },
    });

    if (!lead) {
      throw new NotFoundException('Student account not found');
    }

    if (!lead.studentPortalId) {
      const newPortalId = await this.generateNextStudentPortalId();
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { studentPortalId: newPortalId },
      });
      lead.studentPortalId = newPortalId;
    }

    // Verify method is enabled
    const settings = await this.prisma.emailSetting.findUnique({
      where: { tenantId },
    });
    if (settings && settings.studentPortalLoginEnabled === false) {
      throw new BadRequestException('Login disabled');
    }
    if (settings) {
      if (body.method === 'magic_link' && !settings.studentMagicLinkEnabled) {
        throw new BadRequestException('Magic Link is disabled by admin');
      }
      if (body.method === 'email_otp' && !settings.studentEmailOtpEnabled) {
        throw new BadRequestException('Email OTP is disabled by admin');
      }
      if (body.method === 'sms_otp' && !settings.studentSmsOtpEnabled) {
        throw new BadRequestException('SMS OTP is disabled by admin');
      }
      if (body.method === 'whatsapp_otp' && !settings.studentWhatsappOtpEnabled) {
        throw new BadRequestException('WhatsApp OTP is disabled by admin');
      }
    }

    const now = new Date();

    if (body.method === 'magic_link') {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 mins

      await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          studentMagicToken: token,
          studentMagicExpiresAt: expiresAt,
        },
      });

      const clientOrigin = req.headers['origin'] || 'http://localhost:3001';
      const magicLink = `${clientOrigin}/login/callback?token=${token}`;

      try {
        await this.emailService.sendEmail(
          lead.email!,
          'Student Portal Magic Login Link',
          `Hello ${lead.firstName || 'Student'},\n\nClick the link below to log in to your Student Portal. This link is valid for 15 minutes and can only be used once.\n\n${magicLink}\n\nBest regards,\nStudy Metro Team`,
          `<p>Hello ${lead.firstName || 'Student'},</p><p>Click the link below to log in to your Student Portal. This link is valid for 15 minutes and can only be used once.</p><p><a href="${magicLink}" style="padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Log In to Portal</a></p><p>Or copy this URL: ${magicLink}</p>`,
          tenantId
        );
      } catch (err: any) {
        this.logger.error(`SMTP delivery failed for lead ${lead.id}. Reason: ${err.message}`);
        this.logger.warn('Magic Link generated.');
        throw new BadRequestException('Email service is currently unavailable. Please contact support or enable SMTP.');
      }

      return { success: true, message: 'Magic link sent' };
    } else {
      // OTP-based methods
      const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 mins

      await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          studentOtpCode: otp,
          studentOtpExpiresAt: expiresAt,
          studentOtpAttempts: 0,
        },
      });

      if (body.method === 'email_otp') {
        try {
          await this.emailService.sendEmail(
            lead.email!,
            'Student Portal Login OTP',
            `Hello ${lead.firstName || 'Student'},\n\nYour 6-digit OTP code to access the Student Portal is: ${otp}. It expires in 5 minutes.\n\nBest regards,\nStudy Metro Team`,
            `<p>Hello ${lead.firstName || 'Student'},</p><p>Your 6-digit OTP code to access the Student Portal is:</p><h2>${otp}</h2><p>It expires in 5 minutes.</p>`,
            tenantId
          );
        } catch (err: any) {
          this.logger.error(`SMTP delivery failed for lead ${lead.id}. Reason: ${err.message}`);
          this.logger.warn('Email OTP generated for student.');
          throw new BadRequestException('Email service is currently unavailable. Please contact support or enable SMTP.');
        }
      } else if (body.method === 'sms_otp') {
        await this.sendSmsOtp(lead.phone || 'Unknown', otp);
      } else if (body.method === 'whatsapp_otp') {
        await this.sendWhatsAppOtp(lead.phone || 'Unknown', otp);
      }

      return { success: true, message: `OTP sent via ${body.method}` };
    }
  }

  @Post('verify-otp')
  async verifyOtp(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { email: string; code?: string; token?: string; method?: string }
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    if (!checkRateLimit(`verify-otp:${ip}`)) {
      throw new BadRequestException('Too many requests. Please try again later.');
    }

    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] as string || 'studymetro-global';
    const now = new Date();

    let lead;
    let loginMethod = 'email_otp';

    if (body.token) {
      loginMethod = 'magic_link';
      // Magic Link verification
      lead = await this.prisma.lead.findUnique({
        where: { studentMagicToken: body.token },
      });

      if (!lead || !lead.studentMagicExpiresAt || lead.studentMagicExpiresAt < now) {
        throw new UnauthorizedException('Magic link is invalid or has expired');
      }

      // Invalidate immediately
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          studentMagicToken: null,
          studentMagicExpiresAt: null,
        },
      });
    } else if (body.email && body.code) {
      if (body.method) {
        loginMethod = body.method;
      }
      // OTP verification
      lead = await this.prisma.lead.findFirst({
        where: {
          email: { equals: body.email.trim(), mode: 'insensitive' },
          tenantId,
          deletedAt: null,
        },
      });

      if (!lead || !lead.studentOtpCode || !lead.studentOtpExpiresAt) {
        throw new UnauthorizedException('No active OTP found for this email');
      }

      if (lead.studentOtpExpiresAt < now) {
        throw new UnauthorizedException('OTP has expired. Please request a new one.');
      }

      if (lead.studentOtpAttempts >= 3) {
        throw new UnauthorizedException('Maximum verification attempts exceeded. Please request a new OTP.');
      }

      if (lead.studentOtpCode !== body.code.trim()) {
        await this.prisma.lead.update({
          where: { id: lead.id },
          data: {
            studentOtpAttempts: { increment: 1 },
          },
        });
        throw new UnauthorizedException('Invalid OTP code');
      }

      // Clear OTP on success
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          studentOtpCode: null,
          studentOtpExpiresAt: null,
          studentOtpAttempts: 0,
        },
      });
    } else {
      throw new BadRequestException('Provide email and OTP code, or a magic link token');
    }

    // Generate Student JWT Token
    const payload = {
      sub: lead.id,
      email: lead.email,
      role: 'STUDENT',
      tenantId: lead.tenantId,
      studentPortalId: lead.studentPortalId,
      firstName: lead.firstName,
      lastName: lead.lastName,
      jti: crypto.randomUUID(),
    };

    const token = this.jwtService.sign(payload);

    // Set HttpOnly cookie
    res.cookie('student_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Device / UA parsing
    const userAgentStr = req.headers['user-agent'] || '';
    const uaInfo = parseUserAgent(userAgentStr);

    // Check if this is the student's first login
    const sessionCount = await this.prisma.studentSession.count({
      where: { leadId: lead.id },
    });

    if (sessionCount === 0) {
      await this.prisma.activity.create({
        data: {
          leadId: lead.id,
          type: 'STUDENT_FIRST_LOGIN',
          description: 'Student first login',
          meta: { browser: uaInfo.browser, os: uaInfo.os, device: uaInfo.device },
        },
      });
    }

    // Log the specific login activity
    let loginDescription = 'Student logged in via Email OTP';
    let activityType = 'EMAIL_OTP_LOGIN';

    if (loginMethod === 'magic_link') {
      loginDescription = 'Student logged in via Magic Link';
      activityType = 'MAGIC_LINK_LOGIN';
    } else if (loginMethod === 'sms_otp') {
      loginDescription = 'Student logged in via SMS OTP';
      activityType = 'SMS_OTP_LOGIN';
    } else if (loginMethod === 'whatsapp_otp') {
      loginDescription = 'Student logged in via WhatsApp OTP';
      activityType = 'WHATSAPP_OTP_LOGIN';
    }

    await this.prisma.activity.create({
      data: {
        leadId: lead.id,
        type: activityType,
        description: loginDescription,
        meta: { browser: uaInfo.browser, os: uaInfo.os, device: uaInfo.device, ip },
      },
    });

    // Create session in database
    await this.prisma.studentSession.create({
      data: {
        leadId: lead.id,
        token,
        browser: uaInfo.browser,
        os: uaInfo.os,
        device: uaInfo.device,
        ipAddress: ip,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      success: true,
      token,
      student: {
        id: lead.id,
        email: lead.email,
        firstName: lead.firstName,
        lastName: lead.lastName,
        studentPortalId: lead.studentPortalId,
      },
    };
  }

  @Get('branding')
  async getBranding(@Req() req: Request) {
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'] as string || 'studymetro-global';
    let setting = await this.prisma.portalSetting.findUnique({
      where: { tenantId },
    });
    if (!setting) {
      setting = await this.prisma.portalSetting.create({
        data: {
          tenantId,
          portalName: 'Study Metro Portal',
          primaryColor: '#3b82f6',
          secondaryColor: '#1d4ed8',
          supportEmail: 'support@studymetro.com',
          supportPhone: '+1-800-555-0199',
          footerText: '© 2026 Study Metro. All rights reserved.',
        }
      });
    }
    return setting;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['student_session'] || req.headers['authorization']?.replace('Bearer ', '');
    if (token) {
      await this.prisma.studentSession.updateMany({
        where: { token },
        data: { isActive: false },
      });
    }
    res.clearCookie('student_session');
    return { success: true };
  }

  @UseGuards(StudentJwtAuthGuard)
  @Roles('STUDENT')
  @Get('me')
  async getProfile(@Req() req: any) {
    return req.user;
  }
}

