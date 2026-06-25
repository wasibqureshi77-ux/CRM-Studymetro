import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadDocumentService } from '../document/lead-document.service';
import { StudentJwtAuthGuard } from './guards/student-jwt.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DocumentStatus } from '@prisma/client';
import * as path from 'path';

@UseGuards(StudentJwtAuthGuard)
@Roles('STUDENT')
@Controller('api/v1/student-portal')
export class StudentPortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadDocumentService: LeadDocumentService,
  ) {}

  @Post('documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: any,
    @Body('documentType') documentType: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const studentId = req.user.id;

    if (!documentType) {
      throw new BadRequestException('documentType is required');
    }

    if (!file) {
      throw new BadRequestException('file is required');
    }

    // 10MB limit
    const maxFileSize = 10 * 1024 * 1024;
    if (file.size > maxFileSize) {
      throw new BadRequestException('File size exceeds the maximum limit of 10MB');
    }

    // Supported formats
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      throw new BadRequestException(
        `Unsupported file type: ${fileExt}. Allowed formats are: PDF, JPG, JPEG, PNG, DOCX`,
      );
    }

    // Check if there is an active document checklist item for this type
    const activeDoc = await this.prisma.leadDocument.findFirst({
      where: {
        leadId: studentId,
        documentType,
        isCurrent: true,
      },
    });

    if (!activeDoc) {
      throw new NotFoundException(`No active checklist item found for document type: ${documentType}`);
    }

    if (activeDoc.status !== DocumentStatus.PENDING && activeDoc.status !== DocumentStatus.REJECTED) {
      throw new BadRequestException(
        `Document upload is only allowed for PENDING or REJECTED statuses. Current status is: ${activeDoc.status}`,
      );
    }

    // Re-use LeadDocumentService upload
    const uploaded = await this.leadDocumentService.uploadDocument(
      studentId,
      documentType,
      file,
      null, // Actor ID is null since student is not a staff User
    );

    return {
      success: true,
      message: 'Document uploaded successfully',
      data: uploaded,
    };
  }

  @Get('documents')
  async getDocuments(@Req() req: any) {
    const studentId = req.user.id;
    const docs = await this.prisma.leadDocument.findMany({
      where: { leadId: studentId, isCurrent: true },
      orderBy: { updatedAt: 'desc' },
    });
    return docs;
  }

  @Get('followups')
  async getFollowups(@Req() req: any) {
    const studentId = req.user.id;
    const followups = await this.prisma.followup.findMany({
      where: { leadId: studentId },
      orderBy: { followupDate: 'desc' },
    });
    return followups;
  }

  @Get('communications')
  async getCommunications(@Req() req: any) {
    const studentId = req.user.id;
    const logs = await this.prisma.communicationLog.findMany({
      where: { leadId: studentId },
      orderBy: { sentAt: 'desc' },
    });
    return logs;
  }

  @Get('brochures')
  async getBrochures(@Req() req: any) {
    const studentId = req.user.id;
    const brochures = await this.prisma.brochureAssignment.findMany({
      where: { leadId: studentId },
      include: {
        brochure: true,
        tracking: true,
      },
      orderBy: { assignedAt: 'desc' },
    });
    return brochures;
  }

  @Patch('profile')
  async updateProfile(
    @Req() req: any,
    @Body() body: { phone?: string; address?: string; emergencyContact?: string; photo?: string },
  ) {
    const studentId = req.user.id;

    // Filter editable student fields
    const updateData: any = {};
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.emergencyContact !== undefined) updateData.emergencyContact = body.emergencyContact;
    if (body.photo !== undefined) updateData.photo = body.photo;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No valid fields provided for update');
    }

    const updatedLead = await this.prisma.lead.update({
      where: { id: studentId },
      data: updateData,
    });

    // Add Timeline entry
    await this.prisma.activity.create({
      data: {
        leadId: studentId,
        actorId: null, // Set actorId to null since the student is not a staff User
        type: 'PROFILE_UPDATED',
        description: 'Student updated their profile fields',
        meta: updateData,
      },
    });

    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedLead.id,
        phone: updatedLead.phone,
        address: updatedLead.address,
        emergencyContact: updatedLead.emergencyContact,
        photo: updatedLead.photo,
      },
    };
  }
}
