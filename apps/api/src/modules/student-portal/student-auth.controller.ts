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

  @Post('check-email')
  async checkEmail(@Req() req: Request, @Body() body: { email: string }) {
    const tenantId = req.headers['x-tenant-id'] as string || 'studymetro-global';
    if (!body.email) {
      throw new BadRequestException('Email address is required');
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        email: { equals: body.email.trim(), mode: 'insensitive' },
        tenantId,
        studentPortalId: { not: null },
      },
    });

    if (!lead) {
      return { exists: false };
    }

    // Fetch enabled methods
    const settings = await this.prisma.emailSetting.findUnique({
      where: { tenantId },
    });

    const methods = [];
    if (!settings) {
      // Defaults if settings not configured
      methods.push('magic_link', 'email_otp');
    } else {
      if (settings.studentMagicLinkEnabled) methods.push('magic_link');
      if (settings.studentEmailOtpEnabled) methods.push('email_otp');
      if (settings.studentSmsOtpEnabled) methods.push('sms_otp');
      if (settings.studentWhatsappOtpEnabled) methods.push('whatsapp_otp');
    }

    return {
      exists: true,
      methods,
    };
  }

  @Post('send-otp')
  async sendOtp(@Req() req: Request, @Body() body: { email: string; method: string }) {
    const tenantId = req.headers['x-tenant-id'] as string || 'studymetro-global';
    if (!body.email || !body.method) {
      throw new BadRequestException('Email and method are required');
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        email: { equals: body.email.trim(), mode: 'insensitive' },
        tenantId,
        studentPortalId: { not: null },
      },
    });

    if (!lead) {
      throw new NotFoundException('Student account not found');
    }

    // Verify method is enabled
    const settings = await this.prisma.emailSetting.findUnique({
      where: { tenantId },
    });
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
        this.logger.error(`Failed to send magic link: ${err.message}`);
        // For local development fallback if SMTP is not configured
        this.logger.warn(`FALLBACK: Magic Link URL: ${magicLink}`);
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
          this.logger.error(`Failed to send OTP email: ${err.message}`);
          this.logger.warn(`FALLBACK: OTP Code: ${otp}`);
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
    @Body() body: { email: string; code?: string; token?: string }
  ) {
    const tenantId = req.headers['x-tenant-id'] as string || 'studymetro-global';
    const now = new Date();

    let lead;

    if (body.token) {
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
      // OTP verification
      lead = await this.prisma.lead.findFirst({
        where: {
          email: { equals: body.email.trim(), mode: 'insensitive' },
          tenantId,
          studentPortalId: { not: null },
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
    };

    const token = this.jwtService.sign(payload);

    // Set HttpOnly cookie
    res.cookie('student_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
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
