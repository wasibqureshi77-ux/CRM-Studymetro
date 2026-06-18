import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { FollowupService } from './followup.service';
import { CreateFollowupDto, UpdateFollowupStatusDto, RescheduleFollowupDto } from './dto/followup.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/followups')
export class FollowupController {
  constructor(private readonly followupService: FollowupService) {}

  @Permissions('followup:write')
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateFollowupDto) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.followupService.create(dto, tenantId, actorId);
  }

  @Permissions('followup:write')
  @Patch(':id/status')
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateFollowupStatusDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.followupService.updateStatus(id, dto, tenantId, actorId);
  }

  @Permissions('followup:write')
  @Patch(':id/reschedule')
  async reschedule(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RescheduleFollowupDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.followupService.reschedule(id, dto, tenantId, actorId);
  }

  @Permissions('followup:read')
  @Get('my')
  async getMyFollowups(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    const userId = req.user!.id;
    return this.followupService.findAllForUser(userId, tenantId);
  }

  @Permissions('followup:read')
  @Get()
  async getFollowups(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.followupService.findAllForTenant(tenantId);
  }
}
