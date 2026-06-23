import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto, UpdateApplicationStatusDto } from './dto/application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/applications')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Permissions('lead:write')
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateApplicationDto) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.applicationService.create(dto, tenantId, actorId);
  }

  @Permissions('lead:write')
  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.applicationService.update(id, dto, tenantId, actorId);
  }

  @Permissions('lead:read')
  @Get('lead/:leadId')
  async getByLead(@Req() req: AuthenticatedRequest, @Param('leadId') leadId: string) {
    const tenantId = req.tenantId!;
    return this.applicationService.findByLead(leadId, tenantId);
  }

  @Permissions('lead:read')
  @Get('dashboard/widgets')
  async getDashboardWidgets(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.applicationService.getDashboardWidgets(tenantId);
  }

  @Permissions('lead:read')
  @Get('dashboard/reports')
  async getReports(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.applicationService.getReports(tenantId);
  }
}
