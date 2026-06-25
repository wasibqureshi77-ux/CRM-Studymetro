import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'study-metro-very-secure-jwt-key-2026-sprint1',
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      branchId: payload.branchId,
      role: payload.role,
      firstName: payload.firstName,
      lastName: payload.lastName,
      permissions: payload.permissions || [],
    };
  }
}
