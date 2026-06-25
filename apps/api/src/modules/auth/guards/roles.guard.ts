import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    // Super Admin bypasses all role checks
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Students are restricted to routes explicitly decorated with 'STUDENT'
    if (user.role === 'STUDENT') {
      if (requiredRoles && requiredRoles.includes('STUDENT')) {
        return true;
      }
      throw new ForbiddenException('Access denied');
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(user.role);
      if (!hasRole) {
        throw new ForbiddenException('Forbidden resource');
      }
    }

    return true;
  }
}
