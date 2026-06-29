import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class StudentJwtStrategy extends PassportStrategy(Strategy, 'student-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => {
          if (req && req.cookies) {
            return req.cookies['student_session'];
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'study-metro-very-secure-jwt-key-2026-sprint1',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    if (payload.role !== 'STUDENT') {
      throw new UnauthorizedException('Access restricted to students');
    }

    const token = req.cookies?.['student_session'] || req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Authentication token not found');
    }

    const session = await this.prisma.studentSession.findUnique({
      where: { token },
    });

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is invalid or has expired');
    }

    // Update last activity timestamp
    await this.prisma.studentSession.update({
      where: { id: session.id },
      data: { lastActivity: new Date() },
    });

    const lead = await this.prisma.lead.findUnique({
      where: { id: payload.sub },
    });

    if (!lead || !lead.studentPortalId) {
      throw new UnauthorizedException('Student profile not found');
    }

    return {
      id: lead.id,
      email: lead.email,
      firstName: lead.firstName,
      lastName: lead.lastName,
      tenantId: lead.tenantId,
      studentPortalId: lead.studentPortalId,
      role: 'STUDENT',
    };
  }
}
