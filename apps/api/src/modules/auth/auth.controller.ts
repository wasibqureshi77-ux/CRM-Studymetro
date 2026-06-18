import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { Role } from '@prisma/client';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req: AuthenticatedRequest) {
    return this.authService.login(req.user);
  }

  @Post('register')
  async register(
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      email: string;
      pass: string;
      firstName: string;
      lastName: string;
      role: Role;
      branchId?: string;
    }
  ) {
    const tenantId = req.tenantId;
    return this.authService.register({
      ...body,
      tenantId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
}
