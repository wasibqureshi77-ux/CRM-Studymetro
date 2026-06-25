import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class BranchGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Super Admin bypasses branch restrictions
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Bind branchId boundary to request for queries to consume
    request.branchId = user.branchId;

    // Validate resource branch matches user branch
    const resourceBranchId = request.params.branchId || request.body.branchId;
    if (resourceBranchId && user.branchId !== resourceBranchId) {
      throw new ForbiddenException('Access denied: Resource belongs to another branch');
    }

    return true;
  }
}
