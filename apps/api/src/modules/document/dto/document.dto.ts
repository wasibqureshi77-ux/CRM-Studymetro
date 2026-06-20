import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentType, ApprovalStatus } from '@prisma/client';

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  documentType: DocumentType;
}

export class ApproveDocumentDto {
  @IsEnum(ApprovalStatus)
  approvalStatus: ApprovalStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
