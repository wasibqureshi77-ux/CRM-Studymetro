import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { DocumentStatus } from '@prisma/client';

export class UpdateDocumentStatusDto {
  @IsEnum(DocumentStatus)
  status: DocumentStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UploadLeadDocumentDto {
  @IsString()
  documentType: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
