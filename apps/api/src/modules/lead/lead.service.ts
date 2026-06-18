import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadDto, UpdateLeadDto, AssignLeadDto, CreateNoteDto } from './dto/lead.dto';
import { LeadStatus, LeadSource } from '@prisma/client';

@Injectable()
export class LeadService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmail(email?: string): string | null {
    if (!email) return null;
    return email.trim().toLowerCase().split('+')[0] + (email.includes('@') ? '@' + email.split('@')[1] : '');
  }

  private normalizePhone(phone?: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits ? `+${digits}` : null;
  }

  async create(dto: CreateLeadDto, tenantId: string, actorId: string) {
    const normEmail = this.normalizeEmail(dto.email);
    const normPhone = this.normalizePhone(dto.phone);

    if (normEmail || normPhone) {
      const match = await this.prisma.lead.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            normEmail ? { normalizedEmail: normEmail } : undefined,
            normPhone ? { normalizedPhone: normPhone } : undefined
          ].filter(Boolean) as any
        }
      });

      if (match) {
        await this.prisma.activity.create({
          data: {
            leadId: match.id,
            actorId,
            type: 'INGRESS_MATCH',
            description: 'Duplicate lead match detected during ingestion.',
            meta: { attemptedSource: dto.source },
          }
        });
        return match;
      }
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId }
      });
      if (!branch) {
        throw new BadRequestException('Branch not found under tenant');
      }
    }

    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        normalizedEmail: normEmail,
        phone: dto.phone,
        normalizedPhone: normPhone,
        source: dto.source,
        status: LeadStatus.NEW,
        studentProfile: dto.studentProfile ? {
          create: {
            targetCountry: dto.studentProfile.targetCountry,
            targetCourse: dto.studentProfile.targetCourse,
            intake: dto.studentProfile.intake,
            ieltsStatus: dto.studentProfile.ieltsStatus,
            passportStatus: dto.studentProfile.passportStatus,
            educationLevel: dto.studentProfile.educationLevel,
            percentageGpa: dto.studentProfile.percentageGpa,
            budget: dto.studentProfile.budget,
            currentQualification: dto.studentProfile.currentQualification
          }
        } : undefined
      },
      include: { studentProfile: true }
    });

    await this.prisma.activity.create({
      data: {
        leadId: lead.id,
        actorId,
        type: 'LEAD_CREATED',
        description: `Lead created via ${lead.source}`,
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_CREATE',
        targetEntity: 'Lead',
        targetId: lead.id,
        afterState: lead as any,
      }
    });

    return lead;
  }

  async findAll(
    tenantId: string,
    filters: {
      status?: LeadStatus;
      branchId?: string;
      source?: LeadSource;
      targetCountry?: string;
      intake?: string;
      q?: string;
    }
  ) {
    const searchConditions: any[] = [];

    // 1. Text Search matching on Name, Email, or Phone
    if (filters.q) {
      const cleanQuery = filters.q.trim();
      searchConditions.push({
        OR: [
          { firstName: { contains: cleanQuery, mode: 'insensitive' } },
          { lastName: { contains: cleanQuery, mode: 'insensitive' } },
          { email: { contains: cleanQuery, mode: 'insensitive' } },
          { phone: { contains: cleanQuery } },
        ],
      });
    }

    return this.prisma.lead.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: filters.status,
        branchId: filters.branchId,
        source: filters.source,
        studentProfile: (filters.targetCountry || filters.intake) ? {
          targetCountry: filters.targetCountry,
          intake: filters.intake
        } : undefined,
        AND: searchConditions.length > 0 ? searchConditions : undefined
      },
      include: {
        studentProfile: true,
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        followups: {
          where: { status: 'SCHEDULED' },
          orderBy: { followupDate: 'asc' },
          take: 1
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
  }

  async findOne(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        studentProfile: true,
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { firstName: true, lastName: true } } }
        },
        activities: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, tenantId: string, actorId: string) {
    const lead = await this.findOne(id, tenantId);
    const beforeState = { ...lead };
    const normEmail = dto.email ? this.normalizeEmail(dto.email) : lead.normalizedEmail;
    const normPhone = dto.phone ? this.normalizePhone(dto.phone) : lead.normalizedPhone;

    if (dto.status && dto.status !== lead.status) {
      this.validateStatusTransition(lead.status, dto.status, lead.studentProfile);
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        normalizedEmail: normEmail,
        phone: dto.phone,
        normalizedPhone: normPhone,
        status: dto.status,
        source: dto.source,
        studentProfile: dto.studentProfile ? {
          upsert: {
            create: {
              targetCountry: dto.studentProfile.targetCountry,
              targetCourse: dto.studentProfile.targetCourse,
              intake: dto.studentProfile.intake,
              ieltsStatus: dto.studentProfile.ieltsStatus,
              passportStatus: dto.studentProfile.passportStatus,
              educationLevel: dto.studentProfile.educationLevel,
              percentageGpa: dto.studentProfile.percentageGpa,
              budget: dto.studentProfile.budget,
              currentQualification: dto.studentProfile.currentQualification
            },
            update: {
              targetCountry: dto.studentProfile.targetCountry,
              targetCourse: dto.studentProfile.targetCourse,
              intake: dto.studentProfile.intake,
              ieltsStatus: dto.studentProfile.ieltsStatus,
              passportStatus: dto.studentProfile.passportStatus,
              educationLevel: dto.studentProfile.educationLevel,
              percentageGpa: dto.studentProfile.percentageGpa,
              budget: dto.studentProfile.budget,
              currentQualification: dto.studentProfile.currentQualification
            }
          }
        } : undefined
      },
      include: { studentProfile: true }
    });

    if (dto.status && dto.status !== lead.status) {
      await this.prisma.activity.create({
        data: {
          leadId: id,
          actorId,
          type: 'STATUS_CHANGE',
          description: `Status transitioned from ${lead.status} to ${dto.status}`,
          meta: { from: lead.status, to: dto.status }
        }
      });
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_UPDATE',
        targetEntity: 'Lead',
        targetId: id,
        beforeState: beforeState as any,
        afterState: updated as any,
      }
    });

    return updated;
  }

  async assign(id: string, dto: AssignLeadDto, tenantId: string, actorId: string) {
    const lead = await this.findOne(id, tenantId);
    const beforeState = { ...lead };

    if (dto.assigneeId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assigneeId, tenantId, isActive: true }
      });
      if (!user) {
        throw new BadRequestException('Assignee user not found or inactive');
      }
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: dto.branchId, tenantId }
      });
      if (!branch) {
        throw new BadRequestException('Branch not found under tenant');
      }
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        assigneeId: dto.assigneeId,
        branchId: dto.branchId
      }
    });

    await this.prisma.activity.create({
      data: {
        leadId: id,
        actorId,
        type: 'LEAD_ASSIGNED',
        description: `Lead allocated to user ${dto.assigneeId || 'Unassigned'} under branch ${dto.branchId || 'Unassigned'}`,
      }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_ASSIGN',
        targetEntity: 'Lead',
        targetId: id,
        beforeState: beforeState as any,
        afterState: updated as any,
      }
    });

    return updated;
  }

  async addNote(id: string, dto: CreateNoteDto, tenantId: string, authorId: string) {
    await this.findOne(id, tenantId);

    const note = await this.prisma.note.create({
      data: {
        leadId: id,
        authorId,
        content: dto.content
      }
    });

    await this.prisma.activity.create({
      data: {
        leadId: id,
        actorId: authorId,
        type: 'NOTE_ADDED',
        description: 'New counselor note appended to timeline',
        meta: { noteId: note.id }
      }
    });

    return note;
  }

  async findActivities(
    tenantId: string,
    filters: { leadId?: string; activityType?: string; date?: string }
  ) {
    const whereClause: any = {
      lead: {
        tenantId,
        deletedAt: null
      }
    };

    if (filters.leadId) {
      whereClause.leadId = filters.leadId;
    }

    if (filters.activityType) {
      whereClause.type = filters.activityType;
    }

    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      whereClause.createdAt = {
        gte: start,
        lte: end
      };
    }

    return this.prisma.activity.findMany({
      where: whereClause,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getTimeline(id: string, tenantId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { firstName: true, lastName: true } } }
        },
        activities: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        followups: { orderBy: { followupDate: 'desc' } }
      }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Stitch together all items chronologically
    const timeline = [
      ...lead.activities.map(a => ({ type: 'activity', date: a.createdAt, data: a })),
      ...lead.notes.map(n => ({ type: 'note', date: n.createdAt, data: n })),
      ...lead.documents.map(d => ({ type: 'document', date: d.createdAt, data: d })),
      ...lead.followups.map(f => ({ type: 'followup', date: f.createdAt, data: f }))
    ];

    return timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async bulkAssign(leadIds: string[], assigneeId: string, branchId: string, tenantId: string, actorId: string) {
    // 1. Verify User and Branch are valid
    const user = await this.prisma.user.findFirst({
      where: { id: assigneeId, tenantId, isActive: true }
    });
    if (!user) {
      throw new BadRequestException('Target assignee not found or inactive');
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId }
    });
    if (!branch) {
      throw new BadRequestException('Target branch not found under tenant');
    }

    // 2. Perform bulk update
    const result = await this.prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
        tenantId,
        deletedAt: null
      },
      data: {
        assigneeId,
        branchId
      }
    });

    // 3. Log timeline activity for each modified lead
    for (const leadId of leadIds) {
      await this.prisma.activity.create({
        data: {
          leadId,
          actorId,
          type: 'LEAD_BULK_ASSIGNED',
          description: `Allocated to user ${user.firstName} ${user.lastName} under branch ${branch.name} via bulk action.`,
        }
      });
    }

    // 4. Audit Log
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_BULK_ASSIGN',
        targetEntity: 'Lead',
        targetId: 'BULK_ACTION',
        afterState: { leadIds, assigneeId, branchId } as any
      }
    });

    return result;
  }

  async bulkStatusUpdate(leadIds: string[], status: LeadStatus, tenantId: string, actorId: string) {
    // Perform bulk update
    const result = await this.prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
        tenantId,
        deletedAt: null
      },
      data: { status }
    });

    for (const leadId of leadIds) {
      await this.prisma.activity.create({
        data: {
          leadId,
          actorId,
          type: 'LEAD_BULK_STATUS_UPDATE',
          description: `Status updated to ${status} via bulk action.`,
        }
      });
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_BULK_STATUS',
        targetEntity: 'Lead',
        targetId: 'BULK_ACTION',
        afterState: { leadIds, status } as any
      }
    });

    return result;
  }

  async merge(primaryId: string, duplicateId: string, tenantId: string, actorId: string) {
    const primary = await this.findOne(primaryId, tenantId);
    const duplicate = await this.findOne(duplicateId, tenantId);

    const beforeState = { primary, duplicate };

    // 1. Relocate child entities
    await this.prisma.document.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId }
    });

    await this.prisma.activity.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId }
    });

    await this.prisma.note.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId }
    });

    await this.prisma.followup.updateMany({
      where: { leadId: duplicateId },
      data: { leadId: primaryId }
    });

    // 2. Merge details if empty on primary
    const updateData: any = {};
    if (!primary.phone && duplicate.phone) {
      updateData.phone = duplicate.phone;
      updateData.normalizedPhone = duplicate.normalizedPhone;
    }
    if (!primary.email && duplicate.email) {
      updateData.email = duplicate.email;
      updateData.normalizedEmail = duplicate.normalizedEmail;
    }

    await this.prisma.lead.update({
      where: { id: primaryId },
      data: updateData
    });

    // 3. Soft delete duplicate record
    await this.prisma.lead.update({
      where: { id: duplicateId },
      data: { deletedAt: new Date() }
    });

    // 4. Log merge event on timeline
    await this.prisma.activity.create({
      data: {
        leadId: primaryId,
        actorId,
        type: 'LEAD_MERGED',
        description: `Lead ${duplicate.firstName || ''} ${duplicate.lastName || ''} (ID: ${duplicateId}) was merged into this record.`,
      }
    });

    // 5. Audit Log Entry
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: 'LEAD_MERGE',
        targetEntity: 'Lead',
        targetId: primaryId,
        beforeState: beforeState as any,
        afterState: { primaryId, duplicateId } as any
      }
    });

    return { success: true };
  }

  async getUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, branchId: true }
    });
  }

  async getBranches(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId, isActive: true }
    });
  }

  private validateStatusTransition(from: LeadStatus, to: LeadStatus, profile: any) {
    if (from === LeadStatus.COUNSELLING && to === LeadStatus.COUNTRY_SELECTION) {
      if (!profile || !profile.educationLevel || !profile.percentageGpa) {
        throw new BadRequestException('Cannot select country: Student academic details missing');
      }
    }

    if (from === LeadStatus.NEW && to === LeadStatus.APPLICATION_SUBMITTED) {
      throw new BadRequestException('Cannot skip Counselling and University selection stages');
    }
  }
}
