import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

// Cascading role weights: Higher value is more privileged
const ROLE_WEIGHTS: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 5,
  [Role.TENANT_ADMIN]: 4,
  [Role.BRANCH_MANAGER]: 3,
  [Role.AGENT]: 2,
  [Role.VIEWER]: 1,
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // 1. Verify Tenant alignment (unless SuperAdmin)
    if (user.role !== Role.SUPER_ADMIN && request.tenantId && user.tenantId !== request.tenantId) {
      throw new ForbiddenException('Cross-tenant action forbidden');
    }

    // 2. Cascading Role Check
    if (requiredRoles && requiredRoles.length > 0) {
      const userWeight = ROLE_WEIGHTS[user.role as Role] || 0;
      const meetsRoleRequirements = requiredRoles.some(
        (role) => userWeight >= ROLE_WEIGHTS[role]
      );
      if (!meetsRoleRequirements) {
        throw new ForbiddenException('Insufficient role privilege');
      }
    }

    // 3. Permission Checks
    if (requiredPermissions && requiredPermissions.length > 0) {
      // Map out default permissions for roles
      const userPermissions = this.getPermissionsForRole(user.role as Role);
      const hasPermission = requiredPermissions.every((perm) =>
        userPermissions.includes(perm) || user.role === Role.SUPER_ADMIN
      );
      if (!hasPermission) {
        throw new ForbiddenException('Insufficient permission access token');
      }
    }

    return true;
  }

  private getPermissionsForRole(role: Role): string[] {
    switch (role) {
      case Role.SUPER_ADMIN:
      case Role.TENANT_ADMIN:
        return [
          'leads:read', 'leads:write', 'leads:delete',
          'docs:read', 'docs:write', 'docs:verify',
          'followup:read', 'followup:write',
          'users:read', 'users:write'
        ];
      case Role.BRANCH_MANAGER:
        return [
          'leads:read', 'leads:write',
          'docs:read', 'docs:write', 'docs:verify',
          'followup:read', 'followup:write',
          'users:read'
        ];
      case Role.AGENT:
        return [
          'leads:read', 'leads:write',
          'docs:read', 'docs:write',
          'followup:read', 'followup:write'
        ];
      case Role.VIEWER:
        return ['leads:read', 'docs:read', 'followup:read'];
      default:
        return [];
    }
  }
}
