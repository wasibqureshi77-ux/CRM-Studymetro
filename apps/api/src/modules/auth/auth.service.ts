import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async validateUser(email: string, pass: string, tenantId: string): Promise<any> {
    console.log(`[AUTH DEBUG] validateUser called with: Email: "${email}", TenantId: "${tenantId}"`);
    const emailTrimmed = email.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: emailTrimmed, mode: 'insensitive' },
        tenantId,
      },
    });

    if (!user) {
      console.log(`[AUTH DEBUG] User not found in DB for email "${emailTrimmed}" under tenant "${tenantId}"`);
      return null;
    }

    console.log(`[AUTH DEBUG] User found: ${user.email}. Comparing password...`);
    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    console.log(`[AUTH DEBUG] Password match result: ${isMatch}`);

    if (isMatch) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      permissions: [],
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        branchId: user.branchId,
        permissions: [],
      }
    };
  }


  async register(data: {
    email: string;
    pass: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: string;
    branchId?: string;
  }) {
    // Check if user exists
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new BadRequestException('User already registered');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.pass, salt);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        tenantId: data.tenantId,
        branchId: data.branchId,
      },
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }
}
