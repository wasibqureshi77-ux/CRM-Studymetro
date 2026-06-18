import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { AuthenticatedRequest } from '../../../common/interfaces/request.interface';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(req: AuthenticatedRequest, email: string, pass: string): Promise<any> {
    // Default to 'studymetro-global' in Single Org Mode if no tenant context is provided
    const tenantId = req.tenantId || 'studymetro-global';

    const user = await this.authService.validateUser(email, pass, tenantId);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password credentials');
    }
    return user;
  }
}
