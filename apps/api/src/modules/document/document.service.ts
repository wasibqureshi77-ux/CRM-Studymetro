import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateDocumentDto, ApproveDocumentDto } from './dto/document.dto';
import { ApprovalStatus } from '@prisma/client';

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.document.findMany({
      where: {
        lead: {
          tenantId,
          deletedAt: null
        }
      },
      include: {
        lead: {
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

  async uploadRequest(dto: CreateDocumentDto, tenantId: string, actorId: string) {
    // 1. Verify Lead exists under Tenant
    const lead = await this.prisma.lead.findFirst({
      where: { id: dto.leadId, tenantId, deletedAt: null }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found under tenant');
    }

    // 2. Generate Mock pre-signed URL to Cloudflare R2
    const fileUuid = crypto.randomUUID();
    const mockR2Key = `study-metro-assets/${tenantId}/${dto.leadId}/${fileUuid}_${dto.fileName}`;
    const mockPresignedUrl = `https://r2.studymetro.com/${mockR2Key}?expires=900`;

    // 3. Save pending record in DB
    const doc = await this.prisma.document.create({
      data: {
        leadId: dto.leadId,
        type: dto.type,
        fileName: dto.fileName,
        fileUrl: mockPresignedUrl,
        fileSize: dto.fileSize,
        status: ApprovalStatus.PENDING
      }
    });

    // 4. Log timeline activity
    await this.prisma.activity.create({
      data: {
        leadId: dto.leadId,
        actorId,
        type: 'DOCUMENT_UPLOADED',
        description: `Document ${dto.type} (${dto.fileName}) uploaded. Awaiting approval.`,
        meta: { docId: doc.id }
      }
    });

    return {
      document: doc,
      uploadUrl: mockPresignedUrl
    };
  }

  async approve(id: string, dto: ApproveDocumentDto, tenantId: string, actorId: string) {
    // Verify document scope
    const doc = await this.prisma.document.findFirst({
      where: {
        id,
        lead: { tenantId, deletedAt: null }
      },
      include: { lead: true }
    });

    if (!doc) {
      throw new NotFoundException('Document record not found');
    }

    const beforeState = { ...doc };

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        status: dto.status,
        rejectionReason: dto.status === ApprovalStatus.REJECTED ? dto.rejectionReason : null,
        approvedById: actorId,
        approvedAt: new Date()
      }
    });

    // Log timeline event
    await this.prisma.activity.create({
      data: {
        leadId: doc.leadId,
        actorId,
        type: `DOCUMENT_${dto.status}`,
        description: `Document ${doc.type} marked as ${dto.status}. ${dto.status === ApprovalStatus.REJECTED ? 'Reason: ' + dto.rejectionReason : ''}`,
        meta: { docId: id }
      }
    });

    // Push alert notifications if lead owner exists
    if (doc.lead.assigneeId) {
      await this.notificationService.create(
        doc.lead.assigneeId,
        `Document ${doc.type} ${dto.status}`,
        `The document ${doc.fileName} for lead ${doc.lead.firstName || ''} ${doc.lead.lastName || ''} has been ${dto.status.toLowerCase()}.`
      );
    }

    // Audit Log Integration
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: `DOCUMENT_${dto.status}`,
        targetEntity: 'Document',
        targetId: id,
        beforeState: beforeState as any,
        afterState: updated as any
      }
    });

    return updated;
  }
}
