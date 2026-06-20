import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ApproveDocumentDto } from './dto/document.dto';
import { ApprovalStatus, DocumentType } from '@prisma/client';
import * as path from 'path';

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
        uploadedAt: 'desc'
      }
    });
  }

  async findById(id: string, tenantId: string) {
    const doc = await this.prisma.document.findFirst({
      where: {
        id,
        lead: {
          tenantId,
          deletedAt: null
        }
      }
    });

    if (!doc) {
      throw new NotFoundException('Document not found or access unauthorized');
    }

    return doc;
  }

  async upload(
    file: Express.Multer.File,
    leadId: string,
    documentType: DocumentType,
    tenantId: string,
    actorId: string
  ) {
    // 1. Verify Lead exists under Tenant
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found under tenant');
    }

    const sanitizedOriginal = path.basename(file.originalname);

    // 2. Save document record in DB
    const doc = await this.prisma.document.create({
      data: {
        leadId,
        documentType,
        originalFileName: sanitizedOriginal,
        storedFileName: file.filename,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        approvalStatus: ApprovalStatus.PENDING
      }
    });

    // 3. Log timeline activity
    await this.prisma.activity.create({
      data: {
        leadId,
        actorId,
        type: 'DOCUMENT_UPLOADED',
        description: `Document ${documentType} (${sanitizedOriginal}) uploaded. Awaiting approval.`,
        meta: { docId: doc.id }
      }
    });

    return doc;
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
        approvalStatus: dto.approvalStatus,
        rejectionReason: dto.approvalStatus === ApprovalStatus.REJECTED ? dto.rejectionReason : null,
        approvedById: actorId,
        approvedAt: new Date()
      }
    });

    // Log timeline event
    await this.prisma.activity.create({
      data: {
        leadId: doc.leadId,
        actorId,
        type: `DOCUMENT_${dto.approvalStatus}`,
        description: `Document ${doc.documentType} marked as ${dto.approvalStatus}. ${dto.approvalStatus === ApprovalStatus.REJECTED ? 'Reason: ' + dto.rejectionReason : ''}`,
        meta: { docId: id }
      }
    });

    // Push alert notifications if lead owner exists
    if (doc.lead.assigneeId) {
      await this.notificationService.create(
        doc.lead.assigneeId,
        `Document ${doc.documentType} ${dto.approvalStatus}`,
        `The document ${doc.originalFileName} for lead ${doc.lead.firstName || ''} ${doc.lead.lastName || ''} has been ${dto.approvalStatus.toLowerCase()}.`
      );
    }

    // Audit Log Integration
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: actorId,
        action: `DOCUMENT_${dto.approvalStatus}`,
        targetEntity: 'Document',
        targetId: id,
        beforeState: beforeState as any,
        afterState: updated as any
      }
    });

    return updated;
  }
}
