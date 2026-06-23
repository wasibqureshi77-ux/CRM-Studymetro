import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { FollowupStatus } from '@prisma/client';

export class CreateFollowupDto {
  @IsUUID()
  leadId: string;

  @IsDateString()
  followupDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFollowupStatusDto {
  @IsEnum(FollowupStatus)
  status: FollowupStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RescheduleFollowupDto {
  @IsDateString()
  followupDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

