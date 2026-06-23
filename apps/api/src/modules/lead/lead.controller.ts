import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { LeadService } from './lead.service';
import { CreateLeadDto, UpdateLeadDto, AssignLeadDto, CreateNoteDto, BulkAssignLeadDto, BulkStatusUpdateLeadDto, MergeLeadDto } from './dto/lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { BranchGuard } from '../auth/guards/branch.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { LeadStatus, LeadSource, LeadCategory } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard, BranchGuard)
@Controller('api/v1/leads')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Permissions('leads:write')
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateLeadDto) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.leadService.create(dto, tenantId, actorId);
  }

  @Permissions('leads:write')
  @Post('merge')
  async merge(
    @Req() req: AuthenticatedRequest,
    @Body() dto: MergeLeadDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.leadService.merge(dto.primaryId, dto.duplicateId, tenantId, actorId);
  }

  @Permissions('leads:write')
  @Patch('bulk-assign')
  async bulkAssign(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BulkAssignLeadDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.leadService.bulkAssign(dto.leadIds, dto.assigneeId, dto.branchId, tenantId, actorId);
  }

  @Permissions('leads:write')
  @Patch('bulk-status')
  async bulkStatusUpdate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BulkStatusUpdateLeadDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.leadService.bulkStatusUpdate(dto.leadIds, dto.status, tenantId, actorId);
  }

  @Permissions('leads:read')
  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: LeadStatus,
    @Query('branchId') branchId?: string,
    @Query('source') source?: LeadSource,
    @Query('targetCountry') targetCountry?: string,
    @Query('intake') intake?: string,
    @Query('leadCategory') leadCategory?: LeadCategory,
    @Query('targetScore') targetScore?: string,
    @Query('planningTimeline') planningTimeline?: string,
    @Query('purpose') purpose?: string,
    @Query('courseInterest') courseInterest?: string,
    @Query('q') q?: string,
    @Query('appCountry') appCountry?: string,
    @Query('appUniversity') appUniversity?: string,
    @Query('appCourse') appCourse?: string,
    @Query('appIntake') appIntake?: string,
    @Query('applicationStatus') applicationStatus?: string,
    @Query('offerStatus') offerStatus?: string,
    @Query('visaStatus') visaStatus?: string
  ) {
    const tenantId = req.tenantId!;
    const activeBranchId = req.branchId || branchId;
    return this.leadService.findAll(tenantId, {
      status,
      branchId: activeBranchId,
      source,
      targetCountry,
      intake,
      leadCategory,
      targetScore,
      planningTimeline,
      purpose,
      courseInterest,
      q,
      appCountry,
      appUniversity,
      appCourse,
      appIntake,
      applicationStatus,
      offerStatus,
      visaStatus
    });
  }

  @Permissions('leads:read')
  @Get('meta/activities')
  async findActivities(
    @Req() req: AuthenticatedRequest,
    @Query('leadId') leadId?: string,
    @Query('activityType') activityType?: string,
    @Query('date') date?: string
  ) {
    const tenantId = req.tenantId!;
    return this.leadService.findActivities(tenantId, { leadId, activityType, date });
  }

  @Permissions('leads:read')
  @Get('meta/users')
  async getUsers(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.leadService.getUsers(tenantId);
  }

  @Permissions('leads:read')
  @Get('meta/branches')
  async getBranches(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.leadService.getBranches(tenantId);
  }

  @Permissions('leads:read')
  @Get(':id')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.tenantId!;
    return this.leadService.findOne(id, tenantId);
  }

  @Permissions('leads:read')
  @Get(':id/timeline')
  async getTimeline(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.tenantId!;
    return this.leadService.getTimeline(id, tenantId);
  }

  @Permissions('leads:write')
  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.leadService.update(id, dto, tenantId, actorId);
  }

  @Permissions('leads:write')
  @Patch(':id/assign')
  async assign(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.leadService.assign(id, dto, tenantId, actorId);
  }

  @Permissions('leads:write')
  @Post(':id/notes')
  async addNote(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateNoteDto
  ) {
    const tenantId = req.tenantId!;
    const authorId = req.user!.id;
    return this.leadService.addNote(id, dto, tenantId, authorId);
  }
}
