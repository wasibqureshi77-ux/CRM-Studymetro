import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, Query, ForbiddenException } from '@nestjs/common';
import { LeadService } from './lead.service';
import { CreateLeadDto, UpdateLeadDto, AssignLeadDto, CreateNoteDto, BulkAssignLeadDto, BulkStatusUpdateLeadDto, MergeLeadDto } from './dto/lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BranchGuard } from '../auth/guards/branch.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { LeadStatus, LeadSource, LeadCategory, UserRole } from '@prisma/client';
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

@UseGuards(JwtAuthGuard, RolesGuard, BranchGuard)
@Controller('api/v1/leads')
export class LeadController {
  constructor(
    private readonly leadService: LeadService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateLeadDto) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.leadService.create(dto, tenantId, actorId);
  }

  @Post('merge')
  async merge(
    @Req() req: AuthenticatedRequest,
    @Body() dto: MergeLeadDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    if (req.user!.role === UserRole.COUNSELLOR) {
      const primaryLead = await this.prisma.lead.findUnique({ where: { id: dto.primaryId } });
      const duplicateLead = await this.prisma.lead.findUnique({ where: { id: dto.duplicateId } });
      if (
        (primaryLead && LOCKED_STAGES.includes(primaryLead.status)) ||
        (duplicateLead && LOCKED_STAGES.includes(duplicateLead.status))
      ) {
        throw new ForbiddenException('Counsellors cannot merge leads in or after the Documents Pending stage.');
      }
    }
    return this.leadService.merge(dto.primaryId, dto.duplicateId, tenantId, actorId);
  }

  @Patch('bulk-assign')
  async bulkAssign(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BulkAssignLeadDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    if (req.user!.role === UserRole.COUNSELLOR) {
      const lockedLeads = await this.prisma.lead.findMany({
        where: {
          id: { in: dto.leadIds },
          status: { in: LOCKED_STAGES as LeadStatus[] }
        }
      });
      if (lockedLeads.length > 0) {
        throw new ForbiddenException('Counsellors cannot reassign leads in or after the Documents Pending stage.');
      }
    }
    return this.leadService.bulkAssign(dto.leadIds, dto.assigneeId, dto.branchId, tenantId, actorId);
  }

  @Patch('bulk-status')
  async bulkStatusUpdate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BulkStatusUpdateLeadDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    if (req.user!.role === UserRole.COUNSELLOR) {
      const lockedLeads = await this.prisma.lead.findMany({
        where: {
          id: { in: dto.leadIds },
          status: { in: LOCKED_STAGES as LeadStatus[] }
        }
      });
      if (lockedLeads.length > 0) {
        throw new ForbiddenException('Counsellors cannot change status of leads in or after the Documents Pending stage.');
      }
    }
    return this.leadService.bulkStatusUpdate(dto.leadIds, dto.status, tenantId, actorId);
  }

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
      visaStatus,
      assigneeId: req.user!.role === UserRole.COUNSELLOR ? req.user!.id : undefined
    });
  }

  @Get('meta/activities')
  async findActivities(
    @Req() req: AuthenticatedRequest,
    @Query('leadId') leadId?: string,
    @Query('activityType') activityType?: string,
    @Query('date') date?: string
  ) {
    const tenantId = req.tenantId!;
    const assigneeId = req.user!.role === UserRole.COUNSELLOR ? req.user!.id : undefined;
    return this.leadService.findActivities(tenantId, { leadId, activityType, date, assigneeId });
  }

  @Get('meta/users')
  async getUsers(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.leadService.getUsers(tenantId);
  }

  @Get('meta/branches')
  async getBranches(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.leadService.getBranches(tenantId);
  }

  @Get(':id')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.tenantId!;
    const lead = await this.leadService.findOne(id, tenantId);
    if (req.user!.role === UserRole.COUNSELLOR && lead.assigneeId !== req.user!.id) {
      throw new ForbiddenException('You do not have access to this lead.');
    }
    return lead;
  }

  @Get(':id/timeline')
  async getTimeline(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const tenantId = req.tenantId!;
    if (req.user!.role === UserRole.COUNSELLOR) {
      const lead = await this.prisma.lead.findUnique({ where: { id } });
      if (!lead || lead.assigneeId !== req.user!.id) {
        throw new ForbiddenException('You do not have access to this lead timeline.');
      }
    }
    return this.leadService.getTimeline(id, tenantId);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;

    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      throw new ForbiddenException('Lead not found');
    }

    if (req.user!.role === UserRole.COUNSELLOR) {
      if (lead.assigneeId !== req.user!.id) {
        throw new ForbiddenException('You do not have access to this lead.');
      }

      const updateDto = dto as any;
      if (updateDto.assigneeId !== undefined && updateDto.assigneeId !== lead.assigneeId) {
        throw new ForbiddenException('Counsellors cannot change lead assignee/ownership.');
      }

      if (LOCKED_STAGES.includes(lead.status)) {
        // After DOCUMENTS_PENDING: only allow basic details: firstName, lastName, email, phone, address
        const allowedKeys = ['firstName', 'lastName', 'email', 'phone', 'address'];
        const keysToUpdate = Object.keys(dto).filter(key => updateDto[key] !== undefined && updateDto[key] !== null);
        const disallowedKeys = keysToUpdate.filter(key => !allowedKeys.includes(key));
        
        if (disallowedKeys.length > 0) {
          throw new ForbiddenException(`Counsellors cannot modify post-document processing fields (${disallowedKeys.join(', ')}) after Documents Pending stage.`);
        }
      }
    }

    return this.leadService.update(id, dto, tenantId, actorId);
  }

  @Patch(':id/assign')
  async assign(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    if (req.user!.role === UserRole.COUNSELLOR) {
      throw new ForbiddenException('Only Super Admin can assign or change counsellor.');
    }
    return this.leadService.assign(id, dto, tenantId, actorId);
  }

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
