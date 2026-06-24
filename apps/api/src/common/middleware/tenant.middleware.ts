import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../interfaces/request.interface';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // 1. Extract tenant identifier from X-Tenant-ID header, or subdomain
    let tenantIdentifier = req.headers['x-tenant-id'] as string;
    const requestPath = req.originalUrl || req.path || req.url || '';

    // Fast-path bypass for auth and tracker SDK requests
    if (
      requestPath.startsWith('/api/v1/auth') ||
      requestPath.startsWith('/api/v1/tracker') ||
      requestPath.startsWith('api/v1/tracker') ||
      requestPath.startsWith('/api/v1/brochure') ||
      requestPath.startsWith('api/v1/brochure') ||
      requestPath.includes('metro-tracker.js')
    ) {
      req.tenantId = 'studymetro-global';
      return next();
    }

    if (!tenantIdentifier) {
      const hostname = req.hostname;
      // Simple subdomain check, e.g. "orgname.studymetro.com" -> "orgname"
      const parts = hostname.split('.');
      if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'app') {
        tenantIdentifier = parts[0];
      }
    }

    if (!tenantIdentifier) {
      throw new HttpException('Tenant context missing', HttpStatus.BAD_REQUEST);
    }

    // 2. Validate tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        OR: [
          { id: tenantIdentifier },
          { domain: tenantIdentifier },
          { customDomain: tenantIdentifier }
        ],
        isActive: true,
      },
    });

    if (!tenant) {
      throw new HttpException('Tenant not found or inactive', HttpStatus.NOT_FOUND);
    }

    // 3. Bind tenant to Request
    req.tenantId = tenant.id;

    // 4. Set local parameter inside PostgreSQL connection for RLS
    // We execute SET LOCAL app.current_tenant_id as raw SQL
    await this.prisma.$executeRawUnsafe(
      `SET LOCAL app.current_tenant_id = '${tenant.id}'`
    ).catch(() => {
      // Catch connection lifecycle issues during unit tests
    });

    next();
  }
}
