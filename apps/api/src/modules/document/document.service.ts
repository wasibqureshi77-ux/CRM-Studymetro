import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ApproveDocumentDto } from './dto/document.dto';
import { ApprovalStatus, DocumentType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { encryptPassword } from './utils/encryption.util';
import { PDFDocument } from 'pdf-lib';
import { decryptPDF, isEncrypted } from '@pdfsmaller/pdf-decrypt';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService
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
    actorId: string,
    pdfPassword?: string
  ) {
    // 1. Verify Lead exists under Tenant
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId, deletedAt: null }
    });

    if (!lead) {
      throw new NotFoundException('Lead not found under tenant');
    }

    const sanitizedOriginal = path.basename(file.originalname);
    let isProtected = false;
    let verifiedPassword = '';

    // 2. Validate PDF password if PDF file is uploaded
    if (file.mimetype === 'application/pdf') {
      const fileBytes = fs.readFileSync(file.path);
      let needsPassword = false;
      try {
        const encryptionInfo = await isEncrypted(new Uint8Array(fileBytes));
        needsPassword = encryptionInfo.encrypted;
      } catch (err: any) {
        // If not a valid PDF or parsing failed, we can catch here
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        throw new BadRequestException('Invalid PDF file format or structure.');
      }

      if (needsPassword) {
        if (!pdfPassword) {
          // Cleanup file since it was already saved by Multer
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          throw new BadRequestException('The uploaded PDF is password protected. Please provide the PDF password.');
        }

        try {
          await decryptPDF(new Uint8Array(fileBytes), pdfPassword);
          isProtected = true;
          verifiedPassword = pdfPassword;
        } catch (err: any) {
          // Cleanup file since it was already saved by Multer
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          throw new BadRequestException('Incorrect PDF password provided.');
        }
      }
    }

    const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'study-metro-very-secure-jwt-key-2026-sprint1';
    const encryptedPwd = isProtected ? encryptPassword(verifiedPassword, jwtSecret) : null;

    // 3. Save document record in DB
    const doc = await this.prisma.document.create({
      data: {
        leadId,
        documentType,
        originalFileName: sanitizedOriginal,
        storedFileName: file.filename,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        isPasswordProtected: isProtected,
        pdfPassword: encryptedPwd,
        approvalStatus: ApprovalStatus.PENDING
      }
    });

    // 4. Log timeline activity
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
