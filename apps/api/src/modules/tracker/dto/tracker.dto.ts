import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class TrackEventDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsUUID()
  visitorId: string;

  @IsUUID()
  sessionId: string;

  @IsObject()
  @IsOptional()
  meta?: Record<string, any>;
}

export class TrackFormDto {
  @IsUUID()
  visitorId: string;

  @IsUUID()
  sessionId: string;

  @IsObject()
  formFields: {
    name?: string;
    email?: string;
    phone?: string;
    country?: string;
    course?: string;
    intake?: string;
    [key: string]: any;
  };

  @IsString()
  url: string;

  @IsString()
  @IsOptional()
  referrer?: string;

  @IsString()
  @IsOptional()
  utmSource?: string;

  @IsString()
  @IsOptional()
  utmMedium?: string;

  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @IsString()
  @IsOptional()
  utmContent?: string;

  @IsString()
  @IsOptional()
  utmTerm?: string;
}

export class IdentifyVisitorDto {
  @IsUUID()
  visitorId: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsObject()
  @IsOptional()
  traits?: Record<string, any>;
}
