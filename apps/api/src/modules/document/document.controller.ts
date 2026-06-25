import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Query
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { LeadDocumentService } from './lead-document.service';
import { UpdateDocumentStatusDto, UploadLeadDocumentDto } from './dto/lead-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { PrismaService } from '../../prisma/prisma.service';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

const multerConfig = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const dest = path.join(UPLOAD_ROOT, 'temp');
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const timestamp = Math.floor(Date.now() / 1000);
      cb(null, `${timestamp}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Invalid file format. Only PDF, JPG, JPEG, and PNG are allowed.'), false);
    }
  }
};

const LOCKED_STAGES = [
  'DOCUMENTS_PENDING',
  'DOCUMENTS_RECEIVED',
  'UNIVERSITY_APPLIED',
  'OFFER_LETTER',
  'VISA_PROCESS',
  'ADMISSION_CLOSED',
  'COMPLETED'
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/documents')
export class DocumentController {
  constructor(
    private readonly documentService: LeadDocumentService,
    private readonly prisma: PrismaService
  ) {}

  private async checkLeadAccess(leadId: string, req: AuthenticatedRequest, checkLock = false) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (req.user!.role === UserRole.COUNSELLOR) {
      if (lead.assigneeId !== req.user!.id) {
        throw new ForbiddenException('You do not have access to this lead.');
      }
      if (checkLock && LOCKED_STAGES.includes(lead.status)) {
        throw new ForbiddenException('Counsellors cannot modify documents after Documents Pending stage.');
      }
    }
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  async findAll(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.prisma.leadDocument.findMany({
      where: {
        isCurrent: true,
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
            lastName: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
  }

  @Get('expiring')
  @Roles(UserRole.SUPER_ADMIN)
  async getExpiring(
    @Req() req: AuthenticatedRequest,
    @Query('days') days?: string
  ) {
    const tenantId = req.tenantId!;
    const threshold = days ? parseInt(days, 10) : 90;
    return this.documentService.getExpiringDocuments(tenantId, threshold);
  }

  @Post('upload/:leadId')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async upload(
    @Req() req: AuthenticatedRequest,
    @Param('leadId') leadId: string,
    @Body() dto: UploadLeadDocumentDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded or file was rejected');
    }
    await this.checkLeadAccess(leadId, req, true);

    const actorId = req.user!.id;
    
    if (!dto.documentType) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException('documentType is required');
    }

    try {
      return await this.documentService.uploadDocument(
        leadId,
        dto.documentType,
        file,
        actorId,
        dto.expiryDate
      );
    } catch (error) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  @Patch(':id/approve')
  @Roles(UserRole.SUPER_ADMIN)
  async approve(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: { approvalStatus: string; rejectionReason?: string }
  ) {
    const actorId = req.user!.id;
    const mappedStatus = dto.approvalStatus === 'APPROVED' ? 'VERIFIED' : 'REJECTED';
    return this.documentService.setDocumentStatus(id, mappedStatus as any, actorId, dto.rejectionReason);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN)
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentStatusDto
  ) {
    const actorId = req.user!.id;
    return this.documentService.setDocumentStatus(id, dto.status, actorId, dto.note);
  }

  @Delete(':id')
  async deleteDoc(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string
  ) {
    const doc = await this.prisma.leadDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.checkLeadAccess(doc.leadId, req, true);

    const actorId = req.user!.id;
    return this.documentService.deleteDocument(id, actorId);
  }

  @Get('lead/:leadId')
  async getLeadDocs(
    @Param('leadId') leadId: string,
    @Req() req: AuthenticatedRequest
  ) {
    await this.checkLeadAccess(leadId, req);
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.documentService.generateChecklist(leadId, lead.leadCategory);
  }

  @Get('history/:leadId/:type')
  async getHistory(
    @Param('leadId') leadId: string,
    @Param('type') type: string,
    @Req() req: AuthenticatedRequest
  ) {
    await this.checkLeadAccess(leadId, req);
    return this.documentService.getDocumentHistory(leadId, type);
  }

  @Post('request-missing/:leadId')
  async requestMissing(
    @Req() req: AuthenticatedRequest,
    @Param('leadId') leadId: string
  ) {
    await this.checkLeadAccess(leadId, req, true);
    const actorId = req.user!.id;
    return this.documentService.requestMissingDocuments(leadId, actorId);
  }

  @Get('download/:id')
  async download(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const doc = await this.prisma.leadDocument.findUnique({
      where: { id },
      include: { lead: true }
    });
    if (!doc || !doc.lead) {
      throw new NotFoundException('Document file not found');
    }
    if (req.user!.role === UserRole.COUNSELLOR && doc.lead.assigneeId !== req.user!.id) {
      throw new ForbiddenException('You do not have access to this document.');
    }

    const resolvedPath = path.resolve(UPLOAD_ROOT, doc.filePath || '');
    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Physical file not found');
    }

    res.download(resolvedPath, doc.originalFileName || 'document');
  }

  @Get('view/:id')
  async view(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const doc = await this.prisma.leadDocument.findUnique({
      where: { id },
      include: { lead: true }
    });
    if (!doc || !doc.lead) {
      throw new NotFoundException('Document file not found');
    }
    if (req.user!.role === UserRole.COUNSELLOR && doc.lead.assigneeId !== req.user!.id) {
      throw new ForbiddenException('You do not have access to this document.');
    }

    const resolvedPath = path.resolve(UPLOAD_ROOT, doc.filePath || '');
    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Physical file not found');
    }

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalFileName || 'file')}"`);

    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);
  }
}
