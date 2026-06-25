import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, NotFoundException, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserManagementController {
  constructor(
    private readonly prisma: PrismaService
  ) {}

  @Get('users')
  @Roles(UserRole.SUPER_ADMIN)
  async getUsers(@Req() req: any) {
    const users = await this.prisma.user.findMany({
      where: { tenantId: req.tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        designation: true,
        phone: true,
        role: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return users;
  }

  @Get('users/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async getUserById(@Param('id') id: string, @Req() req: any) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId: req.tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        designation: true,
        phone: true,
        role: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      permissions: [],
    };
  }

  @Post('users')
  @Roles(UserRole.SUPER_ADMIN)
  async createUser(
    @Req() req: any,
    @Body() body: {
      fullName: string;
      email: string;
      password?: string;
      phone?: string;
      designation?: string;
      isActive?: boolean;
      role?: UserRole;
      branchId?: string;
    }
  ) {
    const names = (body.fullName || '').split(' ');
    const firstName = names[0] || 'First';
    const lastName = names.slice(1).join(' ') || 'Last';

    const salt = await bcrypt.genSalt(12);
    const plainPassword = body.password || 'Password123#';
    const passwordHash = await bcrypt.hash(plainPassword, salt);

    const user = await this.prisma.user.create({
      data: {
        tenantId: req.tenantId || 'studymetro-global',
        branchId: body.branchId || null,
        email: body.email,
        passwordHash,
        password: passwordHash, // Keep in sync as per model spec
        firstName,
        lastName,
        fullName: body.fullName || `${firstName} ${lastName}`,
        designation: body.designation || null,
        phone: body.phone || '',
        isActive: body.isActive !== undefined ? body.isActive : true,
        role: body.role || UserRole.COUNSELLOR,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        designation: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: {
      fullName?: string;
      email?: string;
      password?: string;
      phone?: string;
      designation?: string;
      isActive?: boolean;
      role?: UserRole;
      branchId?: string;
    }
  ) {
    // Verify user exists and belongs to the same tenant
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (req.user.role === UserRole.COUNSELLOR) {
      if (id !== req.user.id) {
        throw new ForbiddenException('Counsellors can only update their own password and profile details.');
      }
      if (body.role !== undefined && body.role !== existing.role) {
        throw new ForbiddenException('Counsellors cannot modify user roles.');
      }
      if (body.isActive !== undefined && body.isActive !== existing.isActive) {
        throw new ForbiddenException('Counsellors cannot modify status.');
      }
      if (body.branchId !== undefined && body.branchId !== existing.branchId) {
        throw new ForbiddenException('Counsellors cannot modify branch settings.');
      }
    }

    const data: any = {};

    if (body.fullName !== undefined) {
      data.fullName = body.fullName;
      const names = (body.fullName || '').split(' ');
      data.firstName = names[0] || 'First';
      data.lastName = names.slice(1).join(' ') || 'Last';
    }

    if (body.email !== undefined) {
      data.email = body.email;
    }

    if (body.password !== undefined) {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(body.password, salt);
      data.passwordHash = passwordHash;
      data.password = passwordHash;
    }

    if (body.phone !== undefined) {
      data.phone = body.phone;
    }

    if (body.designation !== undefined) {
      data.designation = body.designation;
    }

    if (body.isActive !== undefined) {
      data.isActive = body.isActive;
    }

    if (body.role !== undefined) {
      data.role = body.role;
    }

    if (body.branchId !== undefined) {
      data.branchId = body.branchId;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        designation: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  @Delete('users/:id')
  @Roles(UserRole.SUPER_ADMIN)
  async deleteUser(@Param('id') id: string, @Req() req: any) {
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { success: true, message: 'User deleted successfully' };
  }
}
