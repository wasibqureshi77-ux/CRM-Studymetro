import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, ValidateNested, IsArray, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStatus, LeadSource } from '@prisma/client';

export class CreateStudentProfileDto {
  @IsOptional()
  @IsString()
  targetCountry?: string;

  @IsOptional()
  @IsString()
  targetCourse?: string;

  @IsOptional()
  @IsString()
  intake?: string;

  @IsOptional()
  @IsString()
  ieltsStatus?: string;

  @IsOptional()
  @IsString()
  passportStatus?: string;

  @IsOptional()
  @IsString()
  educationLevel?: string;

  @IsOptional()
  @IsString()
  percentageGpa?: string;

  @IsOptional()
  @IsString()
  budget?: string;

  @IsOptional()
  @IsString()
  currentQualification?: string;
}

export class CreateLeadDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStudentProfileDto)
  studentProfile?: CreateStudentProfileDto;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateStudentProfileDto)
  studentProfile?: CreateStudentProfileDto;
}

export class AssignLeadDto {
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class CreateNoteDto {
  @IsString()
  content: string;
}

export class UpdateLeadStatusDto {
  @IsEnum(LeadStatus)
  status: LeadStatus;
}

export class BulkAssignLeadDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  leadIds: string[];

  @IsUUID()
  assigneeId: string;

  @IsUUID()
  branchId: string;
}

export class BulkStatusUpdateLeadDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  leadIds: string[];

  @IsEnum(LeadStatus)
  status: LeadStatus;
}

export class MergeLeadDto {
  @IsUUID()
  primaryId: string;

  @IsUUID()
  duplicateId: string;
}

