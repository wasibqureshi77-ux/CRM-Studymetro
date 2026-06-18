import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { DocumentType, ApprovalStatus } from '@prisma/client';

export class CreateDocumentDto {
  @IsUUID()
  leadId: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsString()
  fileName: string;

  @IsNumber()
  fileSize: number;
}

export class ApproveDocumentDto {
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
