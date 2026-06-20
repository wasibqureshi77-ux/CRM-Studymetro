import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { DocumentService } from './document.service';
import { ApproveDocumentDto, UploadDocumentDto } from './dto/document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';
import { ConfigService } from '@nestjs/config';
import { decryptPassword } from './utils/encryption.util';
import { PDFDocument } from 'pdf-lib';
import { decryptPDF } from '@pdfsmaller/pdf-decrypt';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'documents');

const multerConfig = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const leadId = req.params.leadId;
      if (!leadId) {
        return cb(new BadRequestException('Lead ID param is missing'), '');
      }
      const dest = path.join(UPLOAD_ROOT, leadId);
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const timestamp = Math.floor(Date.now() / 1000);
      const original = path.basename(file.originalname);
      const sanitized = original.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `${timestamp}-${sanitized}`);
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

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/documents')
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly configService: ConfigService
  ) {}

  @Permissions('docs:read')
  @Get()
  async findAll(@Req() req: AuthenticatedRequest) {
    const tenantId = req.tenantId!;
    return this.documentService.findAll(tenantId);
  }

  @Permissions('docs:write')
  @Post('upload/:leadId')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async upload(
    @Req() req: AuthenticatedRequest,
    @Param('leadId') leadId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded or file was rejected');
    }
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    
    // Validate documentType is present
    if (!dto.documentType) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException('documentType is required');
    }

    try {
      return await this.documentService.upload(file, leadId, dto.documentType, tenantId, actorId, dto.pdfPassword);
    } catch (error) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  @Permissions('docs:read')
  @Get('download/:documentId')
  async download(
    @Param('documentId') documentId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const tenantId = req.tenantId!;
    const document = await this.documentService.findById(documentId, tenantId);

    const resolvedPath = path.resolve(document.filePath);
    if (!resolvedPath.startsWith(UPLOAD_ROOT)) {
      throw new BadRequestException('Path traversal attempt blocked');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Physical file not found');
    }

    if (document.isPasswordProtected && document.mimeType === 'application/pdf') {
      const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'study-metro-very-secure-jwt-key-2026-sprint1';
      const decryptedPassword = decryptPassword(document.pdfPassword, jwtSecret);
      const fileBytes = fs.readFileSync(resolvedPath);
      try {
        const decryptedPdfBytes = await decryptPDF(new Uint8Array(fileBytes), decryptedPassword);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.originalFileName)}"`);
        res.setHeader('Content-Length', decryptedPdfBytes.length);
        res.send(Buffer.from(decryptedPdfBytes));
        return;
      } catch (err) {
        // Fallback to normal download on error
      }
    }

    res.download(resolvedPath, document.originalFileName);
  }

  @Permissions('docs:read')
  @Get('view/:documentId')
  async view(
    @Param('documentId') documentId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    const tenantId = req.tenantId!;
    const document = await this.documentService.findById(documentId, tenantId);

    const resolvedPath = path.resolve(document.filePath);
    if (!resolvedPath.startsWith(UPLOAD_ROOT)) {
      throw new BadRequestException('Path traversal attempt blocked');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new NotFoundException('Physical file not found');
    }

    if (document.isPasswordProtected && document.mimeType === 'application/pdf') {
      const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'study-metro-very-secure-jwt-key-2026-sprint1';
      const decryptedPassword = decryptPassword(document.pdfPassword, jwtSecret);
      const fileBytes = fs.readFileSync(resolvedPath);
      try {
        const decryptedPdfBytes = await decryptPDF(new Uint8Array(fileBytes), decryptedPassword);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalFileName)}"`);
        res.setHeader('Content-Length', decryptedPdfBytes.length);
        res.send(Buffer.from(decryptedPdfBytes));
        return;
      } catch (err) {
        // Fallback to normal view on error
      }
    }

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalFileName)}"`);

    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);
  }

  @Permissions('docs:verify')
  @Patch(':id/approve')
  async approve(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ApproveDocumentDto
  ) {
    const tenantId = req.tenantId!;
    const actorId = req.user!.id;
    return this.documentService.approve(id, dto, tenantId, actorId);
  }
}
