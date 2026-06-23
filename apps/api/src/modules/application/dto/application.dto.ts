import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApplicationStatus, OfferStatus, VisaStatus } from '@prisma/client';

export class CreateApplicationDto {
  @IsUUID()
  leadId: string;

  @IsString()
  universityName: string;

  @IsString()
  country: string;

  @IsString()
  courseName: string;

  @IsString()
  intake: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateApplicationStatusDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  applicationStatus?: ApplicationStatus;

  @IsOptional()
  @IsEnum(OfferStatus)
  offerStatus?: OfferStatus;

  @IsOptional()
  @IsEnum(VisaStatus)
  visaStatus?: VisaStatus;

  @IsOptional()
  @IsNumber()
  tuitionFee?: number;

  @IsOptional()
  @IsNumber()
  scholarshipAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
