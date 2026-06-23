import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFollowupDto, UpdateFollowupStatusDto } from './dto/followup.dto';
import { FollowupStatus, CommunicationChannel } from '@prisma/client';
import { CommunicationService } from '../communication/communication.service';

@Injectable()
export class FollowupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationService: CommunicationService
  ) {}

  async create(dto: CreateFollowupDto, tenantId: string, actorId: string) {
    // 1. Verify Lead exists under Tenant
    const lead = await this.prisma.lead.findFirst({
      where: { id: dto.leadId, tenantId, deletedAt: null }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found under tenant');
    }

    const selectedDateTime = new Date(dto.followupDate);
    const now = new Date();

    if (selectedDateTime <= now) {
      throw new BadRequestException(
        'Follow-up date and time must be in the future'
      );
    }

    // 2. Create Followup
    const followup = await this.prisma.followup.create({
      data: {
        leadId: dto.leadId,
        assignedUserId: actorId, // default assign to the creator
        followupDate: new Date(dto.followupDate),
        notes: dto.notes,
        status: FollowupStatus.SCHEDULED
      }
    });

    // 3. Log to Activity Timeline
    await this.prisma.activity.create({
      data: {
        leadId: dto.leadId,
        actorId,
        type: 'FOLLOWUP_SCHEDULED',
        description: `Followup scheduled for ${followup.followupDate.toISOString()}`,
        meta: { followupId: followup.id }
      }
    });

    // 4. Create Audit Log entry
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'FOLLOWUP_CREATE',
        targetEntity: 'Followup',
        targetId: followup.id,
        afterState: followup as any
      }
    });

    // Enqueue followup reminder/scheduled communications
    const dateStr = followup.followupDate.toLocaleString();
    await this.communicationService.enqueue(dto.leadId, CommunicationChannel.EMAIL, 'FOLLOWUP_REMINDER', { followupDate: dateStr });
    await this.communicationService.enqueue(dto.leadId, CommunicationChannel.WHATSAPP, 'FOLLOWUP_REMINDER', { followupDate: dateStr });

    return followup;
  }

  async updateStatus(id: string, dto: UpdateFollowupStatusDto, tenantId: string, actorId: string) {
    // Find followup and verify tenant scope via Lead join
    const followup = await this.prisma.followup.findFirst({
      where: {
        id,
        lead: { tenantId, deletedAt: null }
      },
      include: { lead: true }
    });

    if (!followup) {
      throw new NotFoundException('Followup not found');
    }

    const beforeState = { ...followup };

    const updated = await this.prisma.followup.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes
          ? (followup.notes ? `${followup.notes} | Completion Remark: ${dto.notes}` : dto.notes)
          : undefined
      }
    });

    // Log update on activity timeline
    await this.prisma.activity.create({
      data: {
        leadId: followup.leadId,
        actorId,
        type: 'FOLLOWUP_STATUS_CHANGE',
        description: `Followup status changed from ${followup.status} to ${dto.status}${dto.notes ? ` (Remarks: ${dto.notes})` : ''}`,
        meta: { followupId: id, from: followup.status, to: dto.status, remarks: dto.notes }
      }
    });

    // Audit logs
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'FOLLOWUP_STATUS_UPDATE',
        targetEntity: 'Followup',
        targetId: id,
        beforeState: beforeState as any,
        afterState: updated as any
      }
    });

    return updated;
  }

  async findAllForUser(userId: string, tenantId: string) {
    return this.prisma.followup.findMany({
      where: {
        assignedUserId: userId,
        lead: { tenantId, deletedAt: null }
      },
      include: {
        lead: {
          select: { id: true, firstName: true, lastName: true, status: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findAllForTenant(tenantId: string) {
    return this.prisma.followup.findMany({
      where: {
        lead: { tenantId, deletedAt: null }
      },
      include: {
        lead: {
          select: { id: true, firstName: true, lastName: true, status: true, phone: true }
        },
        assignedUser: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async reschedule(id: string, dto: { followupDate: string; notes?: string }, tenantId: string, actorId: string) {
    const followup = await this.prisma.followup.findFirst({
      where: {
        id,
        lead: { tenantId, deletedAt: null }
      },
      include: { lead: true }
    });

    if (!followup) {
      throw new NotFoundException('Followup not found');
    }

    const selectedDateTime = new Date(dto.followupDate);
    const now = new Date();

    if (selectedDateTime <= now) {
      throw new BadRequestException(
        'Follow-up date and time must be in the future'
      );
    }

    const beforeState = { ...followup };

    const updated = await this.prisma.followup.update({
      where: { id },
      data: {
        followupDate: new Date(dto.followupDate),
        notes: dto.notes !== undefined ? dto.notes : followup.notes,
        status: FollowupStatus.SCHEDULED
      }
    });

    await this.prisma.activity.create({
      data: {
        leadId: followup.leadId,
        actorId,
        type: 'FOLLOWUP_RESCHEDULED',
        description: `Followup rescheduled to ${new Date(dto.followupDate).toLocaleString()}`,
        meta: { followupId: id, oldDate: followup.followupDate.toISOString(), newDate: dto.followupDate }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'FOLLOWUP_RESCHEDULE',
        targetEntity: 'Followup',
        targetId: id,
        beforeState: beforeState as any,
        afterState: updated as any
      }
    });

    return updated;
  }
}
