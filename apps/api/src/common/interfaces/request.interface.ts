import { Request } from 'express';
import { User } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  tenantId?: string;
  branchId?: string;
  user?: Partial<User> & {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    branchId?: string;
  };
}
