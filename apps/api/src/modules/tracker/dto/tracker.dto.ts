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
    [key: string]: any;
  };

  @IsString()
  url: string;
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
