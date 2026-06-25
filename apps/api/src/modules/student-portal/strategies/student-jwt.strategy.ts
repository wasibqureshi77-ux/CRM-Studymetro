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
    });
  }

  async validate(payload: any) {
    if (payload.role !== 'STUDENT') {
      throw new UnauthorizedException('Access restricted to students');
    }

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
