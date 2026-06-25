import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto, UpdateApplicationStatusDto } from './dto/application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { PrismaService } from '../../prisma/prisma.service';

const LOCKED_STAGES = [
  'DOCUMENTS_PENDING',
  'DOCUMENTS_RECEIVED',
  'UNIVERSITY_APPLIED',
  'OFFER_LETTER',
  'VISA_PROCESS',
  'ADMISSION_CLOSED',
  'COMPLETED'
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/applications')
export class ApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly prisma: PrismaService
  ) {}

  private async checkLeadAccess(leadId: string, req: AuthenticatedRequest, checkLock = false) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (req.user!.role === UserRole.COUNSELLOR) {
      if (lead.assigneeId !== req.user!.id) {
        throw new ForbiddenException('You do not have access to this lead.');
      }
      if (checkLock && LOCKED_STAGES.includes(lead.status)) {
        throw new ForbiddenException('Counsellors cannot modify applications after Documents Pending stage.');
      }
    }
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateApplicationDto) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    await this.checkLeadAccess(dto.leadId, req, true);
    return this.applicationService.create(dto, tenantId, actorId);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    await this.checkLeadAccess(app.leadId, req, true);
    return this.applicationService.update(id, dto, tenantId, actorId);
  }

  @Get('lead/:leadId')
  async getByLead(@Req() req: AuthenticatedRequest, @Param('leadId') leadId: string) {
    const tenantId = req.tenantId!;
    await this.checkLeadAccess(leadId, req);
    return this.applicationService.findByLead(leadId, tenantId);
  }

  @Get('dashboard/widgets')
  @Roles(UserRole.SUPER_ADMIN)
  async getDashboardWidgets(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.applicationService.getDashboardWidgets(tenantId);
  }

  @Get('dashboard/reports')
  @Roles(UserRole.SUPER_ADMIN)
  async getReports(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.applicationService.getReports(tenantId);
  }
}
