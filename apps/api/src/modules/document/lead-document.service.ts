import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { LocalStorageProvider } from '../../common/storage/local-storage.provider';
import { DocumentTemplates } from './utils/document-templates.config';
import { LeadCategory, DocumentStatus, CommunicationChannel } from '@prisma/client';
import * as path from 'path';
import { CommunicationService } from '../communication/communication.service';

@Injectable()
export class LeadDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly storageProvider: LocalStorageProvider,
    private readonly communicationService: CommunicationService
  ) {}

  async generateChecklist(leadId: string, category: LeadCategory) {
    const templates = DocumentTemplates[category] || [];
    const createdDocs = [];
    for (const item of templates) {
      // Check if checklist item already exists to avoid duplicates
      const exists = await this.prisma.leadDocument.findFirst({
        where: { leadId, documentType: item.type, isCurrent: true }
      });
      if (!exists) {
        const doc = await this.prisma.leadDocument.create({
          data: {
            leadId,
            documentType: item.type,
            isRequired: item.isRequired,
            status: DocumentStatus.PENDING,
            version: 1,
            isCurrent: true,
          }
        });
        createdDocs.push(doc);
      }
    }
    // Calculate and update readiness score
    await this.calculateReadiness(leadId);

    // Enqueue document request communication if any are pending
    const pendingDocs = await this.prisma.leadDocument.findMany({
      where: { leadId, status: DocumentStatus.PENDING, isCurrent: true }
    });
    if (pendingDocs.length > 0) {
      const docTypeList = pendingDocs.map(d => d.documentType).join(', ');
      await this.communicationService.enqueue(leadId, CommunicationChannel.EMAIL, 'DOCUMENT_REQUEST', { documentList: docTypeList });
      await this.communicationService.enqueue(leadId, CommunicationChannel.WHATSAPP, 'DOCUMENT_REQUEST', { documentList: docTypeList });
    }

    return createdDocs;
  }

  async uploadDocument(
    leadId: string,
    documentType: string,
    file: Express.Multer.File,
    actorId: string,
    expiryDateStr?: string
  ) {
    // 1. Fetch current Lead record
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId }
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // 2. Fetch existing active checklist item for this documentType
    let currentDoc = await this.prisma.leadDocument.findFirst({
      where: { leadId, documentType, isCurrent: true }
    });

    let newVersion = 1;
    let isRequired = true;

    // Determine config template required field
    const templates = DocumentTemplates[lead.leadCategory] || [];
    const templateItem = templates.find((t) => t.type === documentType);
    if (templateItem) {
      isRequired = templateItem.isRequired;
    }

    const sanitizedName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const targetFileName = `${Date.now()}-v${newVersion}-${sanitizedName}`;
    const targetPath = path.join('lead-documents', leadId, targetFileName).replace(/\\/g, '/');

    let docRecord;
    const fileUrl = await this.storageProvider.upload(file, targetPath);
    const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;

    if (currentDoc && currentDoc.status === DocumentStatus.PENDING && currentDoc.version === 1) {
      // Update the existing placeholder row
      docRecord = await this.prisma.leadDocument.update({
        where: { id: currentDoc.id },
        data: {
          status: DocumentStatus.UPLOADED,
          originalFileName: file.originalname,
          storedFileName: targetFileName,
          filePath: fileUrl,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date(),
          expiryDate,
        }
      });
    } else {
      if (currentDoc) {
        newVersion = currentDoc.version + 1;
        isRequired = currentDoc.isRequired;

        // Mark old version as not current
        await this.prisma.leadDocument.update({
          where: { id: currentDoc.id },
          data: { isCurrent: false }
        });
      }

      // Save new current version
      docRecord = await this.prisma.leadDocument.create({
        data: {
          leadId,
          documentType,
          version: newVersion,
          isCurrent: true,
          isRequired,
          status: DocumentStatus.UPLOADED,
          originalFileName: file.originalname,
          storedFileName: targetFileName,
          filePath: fileUrl,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date(),
          expiryDate,
        }
      });
    }

    // 5. Add Timeline entry
    const actionType = newVersion > 1 ? 'DOCUMENT_REPLACED' : 'DOCUMENT_UPLOADED';
    await this.prisma.activity.create({
      data: {
        leadId,
        actorId,
        type: actionType,
        description: `${documentType} ${newVersion > 1 ? 'Replaced' : 'Uploaded'} V${newVersion} (${file.originalname})`,
        meta: { docId: docRecord.id, version: newVersion }
      }
    });

    // Calculate readiness
    await this.calculateReadiness(leadId);

    return docRecord;
  }

  async setDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    actorId: string,
    note?: string
  ) {
    const doc = await this.prisma.leadDocument.findUnique({
      where: { id: documentId },
      include: { lead: true }
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    const updated = await this.prisma.leadDocument.update({
      where: { id: documentId },
      data: {
        status,
        verificationNote: note || null,
        verifiedAt: status === DocumentStatus.VERIFIED ? new Date() : null,
        rejectedAt: status === DocumentStatus.REJECTED ? new Date() : null,
        approvedById: actorId,
      }
    });

    // Create activity timeline entry
    await this.prisma.activity.create({
      data: {
        leadId: doc.leadId,
        actorId,
        type: `DOCUMENT_${status}`,
        description: `${doc.documentType} Marked as ${status}${note ? ' - Note: ' + note : ''}`,
        meta: { docId: documentId, version: doc.version }
      }
    });

    // Recalculate readiness
    await this.calculateReadiness(doc.leadId);

    return updated;
  }

  async deleteDocument(documentId: string, actorId: string) {
    const doc = await this.prisma.leadDocument.findUnique({
      where: { id: documentId }
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    if (doc.filePath) {
      await this.storageProvider.delete(doc.filePath);
    }

    const updated = await this.prisma.leadDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.PENDING,
        filePath: null,
        storedFileName: null,
        originalFileName: null,
        fileSize: null,
        mimeType: null,
        uploadedAt: null,
        verifiedAt: null,
        rejectedAt: null,
        verificationNote: null,
      }
    });

    await this.prisma.activity.create({
      data: {
        leadId: doc.leadId,
        actorId,
        type: 'DOCUMENT_DELETED',
        description: `${doc.documentType} V${doc.version} file deleted. Status reset to PENDING.`,
        meta: { docId: documentId }
      }
    });

    await this.calculateReadiness(doc.leadId);

    return updated;
  }

  async calculateReadiness(leadId: string): Promise<number> {
    const documents = await this.prisma.leadDocument.findMany({
      where: { leadId, isCurrent: true }
    });

    const requiredDocs = documents.filter((d) => d.isRequired);
    const verifiedRequiredDocs = requiredDocs.filter((d) => d.status === DocumentStatus.VERIFIED);

    const score = requiredDocs.length
      ? Math.round((verifiedRequiredDocs.length / requiredDocs.length) * 100)
      : 0;

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { readinessScore: score }
    });

    return score;
  }

  async requestMissingDocuments(leadId: string, actorId: string) {
    const documents = await this.prisma.leadDocument.findMany({
      where: { leadId, isCurrent: true, isRequired: true }
    });

    const missingDocs = documents
      .filter((d) => d.status !== DocumentStatus.VERIFIED)
      .map((d) => d.documentType);

    if (missingDocs.length > 0) {
      await this.prisma.activity.create({
        data: {
          leadId,
          actorId,
          type: 'MISSING_DOCUMENTS_REQUESTED',
          description: `Requested missing required documents: ${missingDocs.join(', ')}`,
          meta: { missingDocs }
        }
      });
    }

    return missingDocs;
  }

  async getExpiringDocuments(tenantId: string, daysThreshold: number = 90) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysThreshold);

    return this.prisma.leadDocument.findMany({
      where: {
        isCurrent: true,
        expiryDate: {
          lte: futureDate,
          not: null
        },
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
            lastName: true,
          }
        }
      },
      orderBy: {
        expiryDate: 'asc'
      }
    });
  }

  async getDocumentHistory(leadId: string, documentType: string) {
    return this.prisma.leadDocument.findMany({
      where: { leadId, documentType },
      orderBy: { version: 'desc' }
    });
  }
}
